import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { StorefrontItem } from "./filters";
import { ownershipWording, type OwnershipWording } from "./ownership";

/**
 * Public storefront read service (§8.1) — server-only. Every query scopes to
 * published rows: drops `status='published'`, products `published_at not null`.
 * Draft/unpublished slugs resolve to null → the pages render 404. No private
 * fields (cost basis, private notes, seller contacts) are ever selected.
 */

const PRODUCT_PUBLIC_FIELDS =
  "id, slug, sku, title, brand, description_public, condition_grade, defect_notes, public_price_sgd, availability, synthetic_media_present, published_at, seller_id, source_listing_id, tags(slug, label)";

interface ProductRow {
  id: string;
  slug: string;
  sku: string;
  title: string;
  brand: string | null;
  description_public: string | null;
  condition_grade: string | null;
  defect_notes: string | null;
  public_price_sgd: string | null;
  availability: string;
  synthetic_media_present: boolean;
  published_at: string | null;
  seller_id: string | null;
  source_listing_id: string | null;
  tags: { slug: string; label: string } | null;
}

type TagDimension = "aesthetic" | "material" | "era" | "silhouette";

async function fetchProductTags(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, Record<TagDimension, string[]>>> {
  const map = new Map<string, Record<TagDimension, string[]>>();
  if (productIds.length === 0) return map;
  const { data } = await supabase
    .from("tag_assignments")
    .select("entity_id, tags(slug, dimension)")
    .eq("entity_type", "product")
    .eq("accepted", true)
    .in("entity_id", productIds);
  for (const row of (data ?? []) as unknown as Array<{
    entity_id: string;
    tags: { slug: string; dimension: string } | null;
  }>) {
    if (!row.tags) continue;
    const dim = row.tags.dimension;
    if (dim !== "aesthetic" && dim !== "material" && dim !== "era" && dim !== "silhouette")
      continue;
    const entry =
      map.get(row.entity_id) ?? { aesthetic: [], material: [], era: [], silhouette: [] };
    entry[dim].push(row.tags.slug);
    map.set(row.entity_id, entry);
  }
  return map;
}

async function fetchProductSizes(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (productIds.length === 0) return map;
  const { data } = await supabase
    .from("product_variants")
    .select("product_id, label")
    .in("product_id", productIds);
  for (const row of (data ?? []) as Array<{ product_id: string; label: string }>) {
    const list = map.get(row.product_id) ?? [];
    list.push(row.label);
    map.set(row.product_id, list);
  }
  return map;
}

async function fetchOwnershipStates(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;
  const { data } = await supabase
    .from("ownership_records")
    .select("product_id, state, effective_from")
    .in("product_id", productIds)
    .order("effective_from", { ascending: false });
  for (const row of (data ?? []) as Array<{
    product_id: string;
    state: string;
    effective_from: string;
  }>) {
    // Rows arrive newest-first; first row per product is the current state.
    if (!map.has(row.product_id)) map.set(row.product_id, row.state);
  }
  return map;
}

function toStorefrontItem(
  row: ProductRow,
  tags: Map<string, Record<TagDimension, string[]>>,
  sizes: Map<string, string[]>,
  priceOverrideSgd: string | null = null,
): StorefrontItem {
  const override = priceOverrideSgd !== null ? Number(priceOverrideSgd) : null;
  const base = row.public_price_sgd !== null ? Number(row.public_price_sgd) : null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    brand: row.brand,
    description: row.description_public,
    priceSgd: override ?? base,
    availability: row.availability,
    conditionGrade: row.condition_grade,
    categorySlug: row.tags?.slug ?? null,
    categoryLabel: row.tags?.label ?? null,
    tags: tags.get(row.id) ?? { aesthetic: [], material: [], era: [], silhouette: [] },
    sizes: sizes.get(row.id) ?? [],
    publishedAt: row.published_at,
  };
}

export interface PublishedDropRow {
  id: string;
  slug: string;
  name: string;
  concept: string | null;
  published_at: string | null;
  item_count: number;
}

/** /drops — archive list, published drops only. */
export async function listPublishedDrops(
  supabase: SupabaseClient,
): Promise<PublishedDropRow[]> {
  const { data } = await supabase
    .from("drops")
    .select("id, slug, name, concept, published_at, drop_items(count)")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    slug: row.slug as string,
    name: row.name as string,
    concept: (row.concept as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    item_count:
      (row.drop_items as Array<{ count: number }> | null)?.[0]?.count ?? 0,
  }));
}

export interface PublishedDrop {
  id: string;
  slug: string;
  name: string;
  concept: string | null;
  story: string | null;
  hypothesis_summary: string | null;
  published_at: string | null;
}

/** /drops/[slug] — null when missing or not published (page renders 404). */
export async function getPublishedDropBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PublishedDrop | null> {
  const { data } = await supabase
    .from("drops")
    .select("id, slug, name, concept, story, hypothesis_summary, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  return (data as PublishedDrop | null) ?? null;
}

export interface DropStorefrontItem {
  item: StorefrontItem;
  tier: "entry" | "core" | "hero";
  position: number;
  ownership: OwnershipWording;
}

/** Product grid for a published drop — published products only. */
export async function getDropStorefrontItems(
  supabase: SupabaseClient,
  dropId: string,
): Promise<DropStorefrontItem[]> {
  const { data } = await supabase
    .from("drop_items")
    .select(`id, position, tier, price_override_sgd, products(${PRODUCT_PUBLIC_FIELDS})`)
    .eq("drop_id", dropId)
    .order("position", { ascending: true });

  const joinRows = (data ?? []) as unknown as Array<{
    id: string;
    position: number;
    tier: "entry" | "core" | "hero";
    price_override_sgd: string | null;
    products: ProductRow | null;
  }>;
  const published = joinRows.filter((r) => r.products && r.products.published_at);
  const ids = published.map((r) => r.products!.id);
  const [tags, sizes, ownership] = await Promise.all([
    fetchProductTags(supabase, ids),
    fetchProductSizes(supabase, ids),
    fetchOwnershipStates(supabase, ids),
  ]);

  return published.map((r) => ({
    item: toStorefrontItem(r.products!, tags, sizes, r.price_override_sgd),
    tier: r.tier,
    position: r.position,
    ownership: ownershipWording(ownership.get(r.products!.id) ?? null),
  }));
}

export interface PublicAsset {
  id: string;
  bucket: string;
  path: string;
  alt_text: string | null;
  provenance: string;
  synthetic: boolean;
}

export interface ProductPageData {
  item: StorefrontItem;
  sku: string;
  defectNotes: string | null;
  syntheticMediaPresent: boolean;
  measurements: Array<{
    id: string;
    name: string;
    value: string;
    unit: string;
    method: string | null;
  }>;
  assets: PublicAsset[];
  ownership: OwnershipWording;
  /** Drops this product appears in (published only) — for context links. */
  drops: Array<{ id: string; slug: string; name: string }>;
  /** Referral purchase target, only when purchaseMode === 'referral'. */
  referral: { destination: string; trackedLinkId: string } | null;
}

/** /products/[slug] — null when missing or unpublished (page renders 404). */
export async function getPublishedProductBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<ProductPageData | null> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_PUBLIC_FIELDS)
    .eq("slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const product = data as unknown as ProductRow;

  const [tags, sizes, ownership, measurements, assets, dropLinks] =
    await Promise.all([
      fetchProductTags(supabase, [product.id]),
      fetchProductSizes(supabase, [product.id]),
      fetchOwnershipStates(supabase, [product.id]),
      supabase
        .from("product_measurements")
        .select("id, name, value, unit, method")
        .eq("product_id", product.id)
        .order("name"),
      supabase
        .from("product_assets")
        .select("id, bucket, path, alt_text, provenance, synthetic")
        .eq("product_id", product.id)
        .eq("privacy", "public")
        .order("created_at"),
      supabase
        .from("drop_items")
        .select("drops(id, slug, name, status)")
        .eq("product_id", product.id),
    ]);

  const ownershipState = ownership.get(product.id) ?? null;
  const wording = ownershipWording(ownershipState);

  // Referral purchase target: the seller's original listing URL + the tracked
  // link that attributes the outbound click (§8.1, EVENTS §external_buy_click).
  let referral: ProductPageData["referral"] = null;
  if (wording.purchaseMode === "referral") {
    const [sourceResult, linkResult] = await Promise.all([
      product.source_listing_id
        ? supabase
            .from("source_listings")
            .select("source_url")
            .eq("id", product.source_listing_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("tracked_links")
        .select("id, target_url")
        .ilike("target_url", `%/products/${product.slug}%`)
        .limit(1)
        .maybeSingle(),
    ]);
    const destination = (sourceResult.data as { source_url?: string } | null)
      ?.source_url;
    const trackedLinkId = (linkResult.data as { id?: string } | null)?.id;
    if (destination && trackedLinkId) {
      referral = { destination, trackedLinkId };
    }
  }

  const drops = ((dropLinks.data ?? []) as unknown as Array<{
    drops: { id: string; slug: string; name: string; status: string } | null;
  }>)
    .map((r) => r.drops)
    .filter(
      (d): d is { id: string; slug: string; name: string; status: string } =>
        Boolean(d) && d!.status === "published",
    )
    .map((d) => ({ id: d.id, slug: d.slug, name: d.name }));

  return {
    item: toStorefrontItem(product, tags, sizes),
    sku: product.sku,
    defectNotes: product.defect_notes,
    syntheticMediaPresent:
      product.synthetic_media_present ||
      ((assets.data ?? []) as PublicAsset[]).some((a) => a.synthetic),
    measurements: (measurements.data ?? []) as ProductPageData["measurements"],
    assets: (assets.data ?? []) as PublicAsset[],
    ownership: wording,
    drops,
    referral,
  };
}

/** All published products — /search and related-pieces queries. */
export async function listPublishedProducts(
  supabase: SupabaseClient,
): Promise<StorefrontItem[]> {
  const { data } = await supabase
    .from("products")
    .select(PRODUCT_PUBLIC_FIELDS)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(500);
  const rows = (data ?? []) as unknown as ProductRow[];
  const ids = rows.map((r) => r.id);
  const [tags, sizes] = await Promise.all([
    fetchProductTags(supabase, ids),
    fetchProductSizes(supabase, ids),
  ]);
  return rows.map((r) => toStorefrontItem(r, tags, sizes));
}

/** Related pieces: same category, published, excluding the product itself. */
export function relatedProducts(
  all: StorefrontItem[],
  current: StorefrontItem,
  limit = 4,
): StorefrontItem[] {
  const sameCategory = all.filter(
    (p) =>
      p.id !== current.id &&
      current.categorySlug !== null &&
      p.categorySlug === current.categorySlug,
  );
  const rest = all.filter(
    (p) => p.id !== current.id && p.categorySlug !== current.categorySlug,
  );
  return [...sameCategory, ...rest].slice(0, limit);
}

/** Active tag facets for the filter UI (category/aesthetic/material). */
export async function listFilterFacets(
  supabase: SupabaseClient,
): Promise<Record<"category" | "aesthetic" | "material", Array<{ slug: string; label: string }>>> {
  const { data } = await supabase
    .from("tags")
    .select("slug, label, dimension")
    .in("dimension", ["category", "aesthetic", "material"])
    .eq("is_active", true)
    .order("label");
  const facets: Record<string, Array<{ slug: string; label: string }>> = {
    category: [],
    aesthetic: [],
    material: [],
  };
  for (const row of (data ?? []) as Array<{
    slug: string;
    label: string;
    dimension: string;
  }>) {
    if (row.dimension in facets) {
      facets[row.dimension].push({ slug: row.slug, label: row.label });
    }
  }
  return facets as never;
}
