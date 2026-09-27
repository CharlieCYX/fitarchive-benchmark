import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CatalogFilters, ProductEditInput } from "@/lib/validation/catalog";
import type { AvailabilityStatus } from "./availability";
import {
  allowedAvailabilityTransitions,
  availabilityTransitionError,
} from "./availability";

/**
 * Catalog service (§7.3) — server-only product master queries + mutations.
 * Availability transitions go through the pure state machine; every change
 * is logged by the audit triggers (0018).
 */

export interface ProductListRow {
  id: string;
  sku: string;
  title: string;
  brand: string | null;
  availability: AvailabilityStatus;
  condition_grade: string | null;
  public_price_sgd: string | null;
  published_at: string | null;
  seller_name?: string | null;
  measurement_count?: number;
  asset_count?: number;
}

export async function listProducts(
  supabase: SupabaseClient,
  filters: CatalogFilters,
): Promise<ProductListRow[]> {
  let query = supabase
    .from("products")
    .select(
      "id, sku, title, brand, availability, condition_grade, public_price_sgd, published_at, description_public, sellers(display_name), product_measurements(count), product_assets(count)",
    )
    .order("created_at", { ascending: false })
    .limit(300);

  if (filters.availability) query = query.eq("availability", filters.availability);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);
  if (filters.missing === "data") {
    query = query.or("condition_grade.is.null,description_public.is.null");
  }

  const { data } = await query;
  let rows = ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    sku: row.sku as string,
    title: row.title as string,
    brand: (row.brand as string | null) ?? null,
    availability: row.availability as AvailabilityStatus,
    condition_grade: (row.condition_grade as string | null) ?? null,
    public_price_sgd: (row.public_price_sgd as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    seller_name:
      (row.sellers as { display_name?: string } | null)?.display_name ?? null,
    measurement_count:
      (row.product_measurements as Array<{ count: number }> | null)?.[0]
        ?.count ?? 0,
    asset_count:
      (row.product_assets as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));
  if (filters.missing === "imagery") {
    rows = rows.filter((r) => (r.asset_count ?? 0) === 0);
  }
  return rows;
}

export interface ProductDetail {
  product: Record<string, unknown> & {
    id: string;
    sku: string;
    title: string;
    availability: AvailabilityStatus;
    seller_id: string | null;
    source_listing_id: string | null;
  };
  sellerName: string | null;
  categoryLabel: string | null;
  measurements: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    method: string | null;
  }>;
  ownership: Array<{
    id: string;
    state: string;
    effective_from: string;
    effective_to: string | null;
    note: string | null;
  }>;
  assets: Array<{
    id: string;
    bucket: string;
    path: string;
    privacy: string;
    alt_text: string | null;
    provenance: string;
    synthetic: boolean;
    rights_note: string | null;
  }>;
  sourceListing: { id: string; title: string } | null;
  allowedTransitions: readonly AvailabilityStatus[];
}

export async function getProductDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<ProductDetail | null> {
  const { data: product } = await supabase
    .from("products")
    .select("*, sellers(display_name), tags(label)")
    .eq("id", id)
    .maybeSingle();
  if (!product) return null;

  const [
    { data: measurements },
    { data: ownership },
    { data: assets },
    sourceListingResult,
  ] = await Promise.all([
    supabase
      .from("product_measurements")
      .select("id, name, value, unit, method")
      .eq("product_id", id)
      .order("name"),
    supabase
      .from("ownership_records")
      .select("id, state, effective_from, effective_to, note")
      .eq("product_id", id)
      .order("effective_from", { ascending: false }),
    supabase
      .from("product_assets")
      .select("id, bucket, path, privacy, alt_text, provenance, synthetic, rights_note")
      .eq("product_id", id)
      .order("created_at"),
    product.source_listing_id
      ? supabase
          .from("source_listings")
          .select("id, title")
          .eq("id", product.source_listing_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const row = product as Record<string, unknown>;
  return {
    product: product as ProductDetail["product"],
    sellerName:
      (row.sellers as { display_name?: string } | null)?.display_name ?? null,
    categoryLabel: (row.tags as { label?: string } | null)?.label ?? null,
    measurements: (measurements ?? []) as ProductDetail["measurements"],
    ownership: (ownership ?? []) as ProductDetail["ownership"],
    assets: (assets ?? []) as ProductDetail["assets"],
    sourceListing:
      (sourceListingResult.data as ProductDetail["sourceListing"]) ?? null,
    allowedTransitions: allowedAvailabilityTransitions(
      product.availability as AvailabilityStatus,
    ),
  };
}

export async function listCategoryTags(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; label: string }>> {
  const { data } = await supabase
    .from("tags")
    .select("id, label")
    .eq("dimension", "category")
    .eq("is_active", true)
    .order("label");
  return (data ?? []) as Array<{ id: string; label: string }>;
}

export async function updateProduct(
  supabase: SupabaseClient,
  input: ProductEditInput,
): Promise<{ ok: boolean; error?: string }> {
  const { product_id, ...fields } = input;
  const { error } = await supabase
    .from("products")
    .update(fields)
    .eq("id", product_id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Availability transition (audited). Returns the state-machine error when
 * the move is illegal; publishing is separate (setProductPublication).
 */
export async function transitionAvailability(
  supabase: SupabaseClient,
  productId: string,
  to: AvailabilityStatus,
): Promise<{ ok: boolean; error?: string }> {
  const { data: product } = await supabase
    .from("products")
    .select("availability")
    .eq("id", productId)
    .maybeSingle();
  if (!product) return { ok: false, error: "Product not found." };

  const from = product.availability as AvailabilityStatus;
  const problem = availabilityTransitionError(from, to);
  if (problem) return { ok: false, error: problem };

  const { error } = await supabase
    .from("products")
    .update({ availability: to })
    .eq("id", productId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Publish/unpublish a product. Publishing requires availability='available'
 * (stock gating, §7.5) — permission gating for drops is enforced by
 * features/drops; the storefront publish path lives in Launch Control.
 */
export async function setProductPublication(
  supabase: SupabaseClient,
  productId: string,
  publish: boolean,
): Promise<{ ok: boolean; error?: string }> {
  if (publish) {
    const { data: product } = await supabase
      .from("products")
      .select("availability")
      .eq("id", productId)
      .maybeSingle();
    if (!product) return { ok: false, error: "Product not found." };
    if (product.availability !== "available") {
      return {
        ok: false,
        error: `Only available products can be published (currently ${product.availability}).`,
      };
    }
  }
  const { error } = await supabase
    .from("products")
    .update({ published_at: publish ? new Date().toISOString() : null })
    .eq("id", productId);
  return error ? { ok: false, error: error.message } : { ok: true };
}
