import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Seller portal read model (§7.4, route map §23.1 /seller) — server-only,
 * read-mostly. Runs on the cookie-bound client: RLS does the scoping
 * (sellers_self_read / permissions_seller_read / settlements_seller_read /
 * products_seller_read), so a seller physically cannot load another seller's
 * rows and the queries below can stay simple. Owner accounts may inspect via
 * the owner policies.
 *
 * Column note (0021): products select stays on the PUBLIC column list —
 * sellers never see cost_basis_sgd / notes_private, not even for their own
 * items (Postgres column privileges cannot distinguish roles that share the
 * `authenticated` DB role; owner full-row reads go through the
 * get_owner_product_full RPC in Studio).
 */

export interface SellerPortalItem {
  id: string;
  slug: string;
  sku: string;
  title: string;
  availability: string;
  public_price_sgd: string | null;
  published_at: string | null;
}

export interface SellerPortalPermission {
  id: string;
  scope: string;
  state: string;
  product_title: string | null;
  granted_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface SellerPortalSettlement {
  id: string;
  period_start: string;
  period_end: string;
  gross_sale_sgd: string;
  seller_base_sgd: string;
  platform_fees_sgd: string | null;
  status: string;
  paid_at: string | null;
}

export interface SellerPortalData {
  seller: {
    id: string;
    handle: string;
    display_name: string;
    status: string;
  };
  items: SellerPortalItem[];
  permissions: SellerPortalPermission[];
  settlements: SellerPortalSettlement[];
}

/** Load the signed-in user's seller record + own items/permissions/settlements. */
export async function getSellerPortalData(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellerPortalData | null> {
  const { data: seller } = await supabase
    .from("sellers")
    .select("id, handle, display_name, status")
    .eq("user_id", userId)
    .maybeSingle();
  if (!seller) return null;

  const sellerId = seller.id as string;
  const [
    { data: items },
    { data: permissions },
    { data: settlements },
  ] = await Promise.all([
    supabase
      .from("products")
      .select("id, slug, sku, title, availability, public_price_sgd, published_at")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("permissions")
      .select("id, scope, state, granted_at, expires_at, revoked_at, products(title)")
      .eq("seller_id", sellerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("settlements")
      .select(
        "id, period_start, period_end, gross_sale_sgd, seller_base_sgd, platform_fees_sgd, status, paid_at",
      )
      .eq("seller_id", sellerId)
      .order("period_start", { ascending: false }),
  ]);

  return {
    seller: seller as SellerPortalData["seller"],
    items: (items ?? []) as SellerPortalItem[],
    permissions: ((permissions ?? []) as Array<Record<string, unknown>>).map(
      (p) => ({
        id: p.id as string,
        scope: p.scope as string,
        state: p.state as string,
        product_title: (p.products as { title?: string } | null)?.title ?? null,
        granted_at: (p.granted_at as string | null) ?? null,
        expires_at: (p.expires_at as string | null) ?? null,
        revoked_at: (p.revoked_at as string | null) ?? null,
      }),
    ),
    settlements: (settlements ?? []) as SellerPortalSettlement[],
  };
}
