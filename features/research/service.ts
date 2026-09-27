import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeSourceUrl } from "./urls";
import type { ResearchFilters, SourceListingInput } from "@/lib/validation/research";

/**
 * Research Inbox service (§7.2) — server-only typed queries + mutations.
 * Duplicate detection is by (org_id, normalized_url) — enforced in the DB by
 * the unique partial index and surfaced here as a friendly duplicate result.
 */

export interface SourcePlatform {
  id: string;
  name: string;
  kind: string;
}

export interface SourceListingRow {
  id: string;
  source_platform_id: string;
  platform_name?: string;
  source_url: string | null;
  normalized_url: string | null;
  captured_at: string;
  seller_handle: string | null;
  seller_id: string | null;
  title: string;
  brand: string | null;
  asking_price_sgd: string | null;
  condition_note: string | null;
  visible_engagement: number | null;
  listing_age_days: number | null;
  permission_state: string;
  drop_candidate: boolean;
  is_active: boolean;
  notes: string | null;
}

export interface ResearchObservationRow {
  id: string;
  note: string;
  confidence: number | null;
  observed_at: string;
}

export async function listPlatforms(
  supabase: SupabaseClient,
): Promise<SourcePlatform[]> {
  const { data } = await supabase
    .from("source_platforms")
    .select("id, name, kind")
    .order("name");
  return (data ?? []) as SourcePlatform[];
}

export async function listListings(
  supabase: SupabaseClient,
  filters: ResearchFilters,
): Promise<SourceListingRow[]> {
  let query = supabase
    .from("source_listings")
    .select(
      "id, source_platform_id, source_url, captured_at, seller_handle, title, brand, asking_price_sgd, permission_state, drop_candidate, is_active, source_platforms(name)",
    )
    .eq("is_active", true)
    .order("captured_at", { ascending: false })
    .limit(200);

  if (filters.platform) query = query.eq("source_platform_id", filters.platform);
  if (filters.permission_state)
    query = query.eq("permission_state", filters.permission_state);
  if (filters.drop_candidate === "yes") query = query.eq("drop_candidate", true);
  if (filters.drop_candidate === "no") query = query.eq("drop_candidate", false);
  if (filters.q) query = query.ilike("title", `%${filters.q}%`);

  const { data } = await query;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    ...(row as unknown as SourceListingRow),
    platform_name:
      (row.source_platforms as { name?: string } | null)?.name ?? undefined,
  }));
}

export interface ListingDetail {
  listing: SourceListingRow;
  observations: ResearchObservationRow[];
  promotedProduct: { id: string; sku: string; title: string } | null;
}

export async function getListingDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<ListingDetail | null> {
  const { data } = await supabase
    .from("source_listings")
    .select("*, source_platforms(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  const [{ data: observations }, { data: promoted }] = await Promise.all([
    supabase
      .from("research_observations")
      .select("id, note, confidence, observed_at")
      .eq("source_listing_id", id)
      .order("observed_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, sku, title")
      .eq("source_listing_id", id)
      .maybeSingle(),
  ]);

  const row = data as Record<string, unknown>;
  return {
    listing: {
      ...(row as unknown as SourceListingRow),
      platform_name:
        (row.source_platforms as { name?: string } | null)?.name ?? undefined,
    },
    observations: (observations ?? []) as ResearchObservationRow[],
    promotedProduct: (promoted as ListingDetail["promotedProduct"]) ?? null,
  };
}

export type CreateListingResult =
  | { ok: true; id: string; duplicate: false; unmatchedTags: string[] }
  | { ok: true; id: string; duplicate: true }
  | { ok: false; error: string };

export async function createListing(
  supabase: SupabaseClient,
  orgId: string,
  input: SourceListingInput,
  extras: { categoryTagId?: string | null; tags?: string[]; actorId?: string | null },
): Promise<CreateListingResult> {
  const normalized = normalizeSourceUrl(input.source_url ?? null);

  if (normalized) {
    const { data: existing } = await supabase
      .from("source_listings")
      .select("id")
      .eq("org_id", orgId)
      .eq("normalized_url", normalized)
      .maybeSingle();
    if (existing) {
      return { ok: true, id: existing.id as string, duplicate: true };
    }
  }

  const { data: inserted, error } = await supabase
    .from("source_listings")
    .insert({
      org_id: orgId,
      source_platform_id: input.source_platform_id,
      source_url: input.source_url ?? null,
      normalized_url: normalized,
      captured_at: new Date().toISOString(),
      seller_handle: input.seller_handle ?? null,
      title: input.title,
      brand: input.brand ?? null,
      asking_price_sgd: input.asking_price_sgd ?? null,
      condition_note: input.condition_note ?? null,
      visible_engagement: input.visible_engagement ?? null,
      listing_age_days: input.listing_age_days ?? null,
      notes: input.notes ?? null,
      drop_candidate: input.drop_candidate,
      permission_state: "observed_only",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }
  const listingId = inserted.id as string;

  // Taxonomy: category + free tags become human-sourced tag_assignments.
  const unmatchedTags: string[] = [];
  const assignments: Array<Record<string, unknown>> = [];
  if (extras.categoryTagId) {
    assignments.push({
      tag_id: extras.categoryTagId,
      entity_type: "source_listing",
      entity_id: listingId,
      source: "human",
      created_by: extras.actorId ?? null,
    });
  }
  for (const raw of extras.tags ?? []) {
    const needle = raw.trim().toLowerCase();
    if (!needle) continue;
    const { data: tag } = await supabase
      .from("tags")
      .select("id")
      .eq("is_active", true)
      .or(`slug.eq.${needle},label.ilike.${needle}`)
      .limit(1)
      .maybeSingle();
    if (tag) {
      assignments.push({
        tag_id: tag.id,
        entity_type: "source_listing",
        entity_id: listingId,
        source: "human",
        created_by: extras.actorId ?? null,
      });
    } else {
      unmatchedTags.push(raw.trim());
    }
  }
  if (assignments.length > 0) {
    await supabase.from("tag_assignments").insert(assignments);
  }

  return { ok: true, id: listingId, duplicate: false, unmatchedTags };
}

export async function addObservation(
  supabase: SupabaseClient,
  listingId: string,
  note: string,
  confidence: number | null,
  observerId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from("research_observations").insert({
    source_listing_id: listingId,
    observed_at: new Date().toISOString(),
    observer_id: observerId,
    note,
    confidence,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Promote a listing to a draft catalog product (§7.2 → §7.3).
 * Creates the product (draft, unpublished), an ownership record carrying the
 * listing's permission state, and links product → source listing (0019).
 */
export async function promoteListing(
  supabase: SupabaseClient,
  orgId: string,
  listingId: string,
): Promise<{ ok: boolean; productId?: string; error?: string }> {
  const { data: listing } = await supabase
    .from("source_listings")
    .select("*")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return { ok: false, error: "Listing not found." };

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("source_listing_id", listingId)
    .maybeSingle();
  if (existing) {
    return {
      ok: false,
      error: "Already promoted — this listing is linked to a product.",
    };
  }

  // Next FA-### SKU (A11).
  const { data: skus } = await supabase.from("products").select("sku");
  let max = 0;
  for (const row of (skus ?? []) as Array<{ sku: string }>) {
    const m = /^FA-(\d+)$/.exec(row.sku);
    if (m) max = Math.max(max, Number(m[1]));
  }
  const sku = `FA-${String(max + 1).padStart(3, "0")}`;

  const slugBase = (listing.title as string)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const slug = `${slugBase || "item"}-${sku.toLowerCase()}`;

  const { data: product, error } = await supabase
    .from("products")
    .insert({
      org_id: orgId,
      slug,
      sku,
      title: listing.title,
      brand: listing.brand,
      seller_id: listing.seller_id,
      source_listing_id: listingId,
      availability: "draft",
      public_price_sgd: listing.asking_price_sgd,
      defect_notes: listing.condition_note,
      notes_private: listing.notes
        ? `Promoted from research listing ${listingId}.\n\n${listing.notes}`
        : `Promoted from research listing ${listingId}.`,
    })
    .select("id")
    .single();

  if (error || !product) {
    return { ok: false, error: error?.message ?? "Product insert failed." };
  }

  await supabase.from("ownership_records").insert({
    product_id: product.id,
    state: listing.permission_state ?? "observed_only",
    effective_from: new Date().toISOString(),
    note: `Carried over from source listing on promote.`,
  });

  return { ok: true, productId: product.id as string };
}
