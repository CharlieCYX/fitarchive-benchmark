import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PermissionState } from "./permissions";
import { isPermissionValid } from "./permissions";

/**
 * Seller CRM + Permission Ledger service (§7.4) — server-only.
 * Revoking permission unpublishes affected products here (§7.4 AC);
 * every change is written to audit_log by the 0018 triggers.
 */

export interface SellerListRow {
  id: string;
  handle: string;
  display_name: string;
  status: string;
  open_permissions: number;
  product_count: number;
}

export async function listSellers(
  supabase: SupabaseClient,
): Promise<SellerListRow[]> {
  const { data } = await supabase
    .from("sellers")
    .select(
      "id, handle, display_name, status, permissions(state), products(count)",
    )
    .order("display_name");
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    handle: row.handle as string,
    display_name: row.display_name as string,
    status: row.status as string,
    open_permissions: (
      (row.permissions as Array<{ state: string }> | null) ?? []
    ).filter((p) => p.state === "contacted" || p.state === "observed_only")
      .length,
    product_count:
      (row.products as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));
}

export interface SellerDetail {
  seller: {
    id: string;
    handle: string;
    display_name: string;
    status: string;
    notes_private: string | null;
  };
  contacts: Array<{
    id: string;
    channel: string;
    value: string;
    is_preferred: boolean;
  }>;
  permissions: Array<{
    id: string;
    product_id: string | null;
    product_title?: string | null;
    scope: string;
    state: PermissionState;
    granted_at: string | null;
    expires_at: string | null;
    revoked_at: string | null;
  }>;
  agreements: Array<{
    id: string;
    type: string;
    seller_share_pct: string | null;
    seller_fixed_amount_sgd: string | null;
    fulfillment_responsibility: string | null;
    payout_reference: string | null;
    return_terms: string | null;
    status: string;
    ends_at: string | null;
  }>;
  settlements: Array<{
    id: string;
    period_start: string;
    period_end: string;
    gross_sale_sgd: string;
    platform_fees_sgd: string | null;
    seller_base_sgd: string;
    fitarchive_gross_sgd: string;
    fitarchive_contribution_sgd: string;
    status: string;
    paid_at: string | null;
  }>;
}

export async function getSellerDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<SellerDetail | null> {
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, handle, display_name, status, notes_private")
    .eq("id", id)
    .maybeSingle();
  if (!seller) return null;

  const [
    { data: contacts },
    { data: permissions },
    { data: agreements },
    { data: settlements },
  ] = await Promise.all([
    supabase
      .from("seller_contacts")
      .select("id, channel, value, is_preferred")
      .eq("seller_id", id)
      .order("is_preferred", { ascending: false }),
    supabase
      .from("permissions")
      .select("id, product_id, scope, state, granted_at, expires_at, revoked_at, products(title)")
      .eq("seller_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("agreements")
      .select(
        "id, type, seller_share_pct, seller_fixed_amount_sgd, fulfillment_responsibility, payout_reference, return_terms, status, ends_at",
      )
      .eq("seller_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("settlements")
      .select(
        "id, period_start, period_end, gross_sale_sgd, platform_fees_sgd, seller_base_sgd, fitarchive_gross_sgd, fitarchive_contribution_sgd, status, paid_at",
      )
      .eq("seller_id", id)
      .order("period_start", { ascending: false }),
  ]);

  return {
    seller: seller as SellerDetail["seller"],
    contacts: (contacts ?? []) as SellerDetail["contacts"],
    permissions: ((permissions ?? []) as Array<Record<string, unknown>>).map(
      (p) => ({
        ...(p as unknown as SellerDetail["permissions"][number]),
        product_title:
          (p.products as { title?: string } | null)?.title ?? null,
      }),
    ),
    agreements: (agreements ?? []) as SellerDetail["agreements"],
    settlements: (settlements ?? []) as SellerDetail["settlements"],
  };
}

/**
 * Revoke a permission (§7.4 AC): mark expired_revoked, then UNPUBLISH every
 * affected product that is not otherwise owned/validly permitted. Returns the
 * list of unpublished product titles for the operator notice. All writes are
 * audited by the 0018 triggers (update on permissions + publication_change
 * on products).
 */
export async function revokePermission(
  supabase: SupabaseClient,
  permissionId: string,
): Promise<{ ok: boolean; unpublished: string[]; error?: string }> {
  const { data: permission } = await supabase
    .from("permissions")
    .select("id, seller_id, product_id")
    .eq("id", permissionId)
    .maybeSingle();
  if (!permission) return { ok: false, unpublished: [], error: "Permission not found." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("permissions")
    .update({ state: "expired_revoked", revoked_at: now })
    .eq("id", permissionId);
  if (error) return { ok: false, unpublished: [], error: error.message };

  // Affected products: the specific product, or all of the seller's products
  // for a seller-scoped permission.
  let productQuery = supabase
    .from("products")
    .select("id, title")
    .eq("seller_id", permission.seller_id)
    .not("published_at", "is", null);
  if (permission.product_id) productQuery = productQuery.eq("id", permission.product_id);
  const { data: affected } = await productQuery;

  const unpublished: string[] = [];
  for (const product of (affected ?? []) as Array<{ id: string; title: string }>) {
    // Does the product still have ANY valid permission or owned state?
    const [{ data: ownership }, { data: otherPermissions }] = await Promise.all([
      supabase
        .from("ownership_records")
        .select("state")
        .eq("product_id", product.id)
        .is("effective_to", null)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("permissions")
        .select("state, granted_at, expires_at, revoked_at")
        .eq("seller_id", permission.seller_id)
        .or(`product_id.eq.${product.id},product_id.is.null`)
        .neq("id", permissionId),
    ]);
    const owned = ownership?.state === "owned";
    const stillValid = ((otherPermissions ?? []) as Parameters<typeof isPermissionValid>[0][]).some(
      (p) => isPermissionValid(p),
    );
    if (!owned && !stillValid) {
      const { error: unpublishError } = await supabase
        .from("products")
        .update({ published_at: null })
        .eq("id", product.id);
      if (unpublishError) {
        return { ok: false, unpublished, error: unpublishError.message };
      }
      unpublished.push(product.title);
    }
  }
  return { ok: true, unpublished };
}
