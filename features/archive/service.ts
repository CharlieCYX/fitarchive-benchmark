import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shopper Archive reads (§8.2) — server-only. Everything here is scoped to
 * the signed-in profile and private by default (§15.2); collections only
 * leave the profile when `is_public` is explicitly toggled.
 */

export interface ArchiveFavorite {
  favoriteId: string;
  productId: string;
  title: string;
  slug: string;
  priceSgd: string | number | null;
  availability: string;
  createdAt: string;
}

export interface ArchiveCollection {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  itemCount: number;
}

export interface ArchiveClosetItem {
  id: string;
  title: string;
  category: string | null;
  color: string | null;
  fitNotes: string | null;
  wearFrequency: string | null;
  ownershipSource: string | null;
  createdAt: string;
}

export interface ArchiveReference {
  id: string;
  source: string;
  url: string | null;
  note: string | null;
  attributes: Array<{ dimension: string; value: string; confidence: number | null; source: string }>;
}

export interface ArchiveOutfit {
  id: string;
  title: string;
  thesis: string | null;
  occasion: string | null;
  climate: string | null;
  items: Array<{ role: string | null; label: string; href: string | null }>;
}

export async function loadFavorites(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ArchiveFavorite[]> {
  const { data } = await supabase
    .from("favorites")
    .select("id, product_id, created_at, products(title, slug, public_price_sgd, availability)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const product = row.products as {
      title: string;
      slug: string;
      public_price_sgd: string | number | null;
      availability: string;
    } | null;
    return {
      favoriteId: row.id as string,
      productId: row.product_id as string,
      title: product?.title ?? "(product unavailable)",
      slug: product?.slug ?? "",
      priceSgd: product?.public_price_sgd ?? null,
      availability: product?.availability ?? "unknown",
      createdAt: row.created_at as string,
    };
  });
}

export async function loadCollections(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ArchiveCollection[]> {
  const { data } = await supabase
    .from("collections")
    .select("id, title, description, is_public, collection_items(id)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    isPublic: row.is_public as boolean,
    itemCount: ((row.collection_items as Array<{ id: string }> | null) ?? []).length,
  }));
}

export async function loadClosetItems(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ArchiveClosetItem[]> {
  const { data } = await supabase
    .from("closet_items")
    .select("id, title, color, fit_notes, wear_frequency, ownership_source, created_at, tags!closet_items_category_id_fkey(slug)")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    category: (row.tags as { slug: string } | null)?.slug ?? null,
    color: (row.color as string | null) ?? null,
    fitNotes: (row.fit_notes as string | null) ?? null,
    wearFrequency: (row.wear_frequency as string | null) ?? null,
    ownershipSource: (row.ownership_source as string | null) ?? null,
    createdAt: row.created_at as string,
  }));
}

export async function loadStyleReferences(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ArchiveReference[]> {
  const { data } = await supabase
    .from("style_references")
    .select("id, source, url, note, style_reference_attributes(dimension, free_value, confidence, source, tags(slug))")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    source: row.source as string,
    url: (row.url as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    attributes: (
      (row.style_reference_attributes as Array<Record<string, unknown>> | null) ?? []
    ).map((attr) => ({
      dimension: attr.dimension as string,
      value:
        ((attr.tags as { slug: string } | null)?.slug ?? null) ??
        (attr.free_value as string | null) ??
        "?",
      confidence: attr.confidence === null ? null : Number(attr.confidence),
      source: attr.source as string,
    })),
  }));
}

export async function loadSavedOutfits(
  supabase: SupabaseClient,
  profileId: string,
): Promise<ArchiveOutfit[]> {
  const { data } = await supabase
    .from("outfits")
    .select("id, title, thesis, occasion, climate, outfit_items(role, placeholder_label, products(title, slug), closet_items(title))")
    .eq("profile_id", profileId)
    .eq("is_saved", true)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    thesis: (row.thesis as string | null) ?? null,
    occasion: (row.occasion as string | null) ?? null,
    climate: (row.climate as string | null) ?? null,
    items: (
      (row.outfit_items as Array<Record<string, unknown>> | null) ?? []
    ).map((item) => {
      const product = item.products as { title: string; slug: string } | null;
      const closet = item.closet_items as { title: string } | null;
      return {
        role: (item.role as string | null) ?? null,
        label:
          product?.title ?? closet?.title ?? (item.placeholder_label as string) ?? "placeholder",
        href: product?.slug ? `/products/${product.slug}` : null,
      };
    }),
  }));
}

export interface CollectionDetail {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  ownedByViewer: boolean;
  items: Array<{
    id: string;
    note: string | null;
    position: number;
    product: { id: string; title: string; slug: string; priceSgd: string | number | null } | null;
    reference: { id: string; note: string | null; url: string | null } | null;
  }>;
}

/** Collection detail — owner always; public collections readable by all. */
export async function loadCollectionDetail(
  supabase: SupabaseClient,
  collectionId: string,
  viewerProfileId: string | null,
): Promise<CollectionDetail | null> {
  const { data } = await supabase
    .from("collections")
    .select("id, title, description, is_public, profile_id, collection_items(id, note, position, products(id, title, slug, public_price_sgd), style_references(id, note, url))")
    .eq("id", collectionId)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const ownerId = (row.profile_id as string | null) ?? null;
  const isPublic = row.is_public as boolean;
  if (!isPublic && ownerId !== viewerProfileId) return null;
  const items = ((row.collection_items as Array<Record<string, unknown>> | null) ?? [])
    .map((item) => {
      const product = item.products as {
        id: string;
        title: string;
        slug: string;
        public_price_sgd: string | number | null;
      } | null;
      const reference = item.style_references as {
        id: string;
        note: string | null;
        url: string | null;
      } | null;
      return {
        id: item.id as string,
        note: (item.note as string | null) ?? null,
        position: (item.position as number | null) ?? 0,
        product: product
          ? { id: product.id, title: product.title, slug: product.slug, priceSgd: product.public_price_sgd }
          : null,
        reference: reference
          ? { id: reference.id, note: reference.note, url: reference.url }
          : null,
      };
    })
    .sort((a, b) => a.position - b.position);
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    isPublic,
    ownedByViewer: ownerId !== null && ownerId === viewerProfileId,
    items,
  };
}
