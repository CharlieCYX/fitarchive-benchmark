/**
 * Storefront filter/sort/search core (§8.1 filter+sort, §9.3 deterministic
 * fallback). Pure module — unit-tested in tests/unit/storefront-query.test.ts.
 *
 * Server-side query params are the source of truth; the service layer scopes
 * to published rows in SQL first, then applies these filters. The AI parse
 * layer (Phase 6/7) will translate natural language INTO this same filter
 * shape — the deterministic path stays the fallback.
 */

export interface StorefrontItem {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  description: string | null;
  /** Effective price in SGD (drop override wins); null = no public price. */
  priceSgd: number | null;
  availability: string;
  conditionGrade: string | null;
  categorySlug: string | null;
  categoryLabel: string | null;
  /** Accepted tag slugs by dimension. */
  tags: {
    aesthetic: string[];
    material: string[];
    era: string[];
    silhouette: string[];
  };
  /** Structured size labels from product_variants (empty when none exist). */
  sizes: string[];
  publishedAt: string | null;
}

export const STOREFRONT_SORTS = [
  "newest",
  "price_asc",
  "price_desc",
  "title",
] as const;
export type StorefrontSort = (typeof STOREFRONT_SORTS)[number];

export interface StorefrontFilters {
  q: string | null;
  category: string | null;
  aesthetic: string | null;
  material: string | null;
  /** Colour is a text match (no structured colour field in V1 — honest). */
  color: string | null;
  size: string | null;
  availability: "available" | "reserved" | "sold" | null;
  minPrice: number | null;
  maxPrice: number | null;
  sort: StorefrontSort;
}

export const EMPTY_FILTERS: StorefrontFilters = {
  q: null,
  category: null,
  aesthetic: null,
  material: null,
  color: null,
  size: null,
  availability: null,
  minPrice: null,
  maxPrice: null,
  sort: "newest",
};

type ParamsLike = Record<string, string | string[] | undefined>;

function first(params: ParamsLike, key: string): string | null {
  const v = params[key];
  const raw = Array.isArray(v) ? v[0] : v;
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed.slice(0, 200);
}

function money(params: ParamsLike, key: string): number | null {
  const raw = first(params, key);
  if (raw === null) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return null;
  return n;
}

/** Parse URL search params into validated filters; junk values drop out. */
export function parseStorefrontFilters(params: ParamsLike): StorefrontFilters {
  const sortRaw = first(params, "sort");
  const availabilityRaw = first(params, "availability");
  return {
    q: first(params, "q"),
    category: first(params, "category")?.toLowerCase() ?? null,
    aesthetic: first(params, "aesthetic")?.toLowerCase() ?? null,
    material: first(params, "material")?.toLowerCase() ?? null,
    color: first(params, "color")?.toLowerCase() ?? null,
    size: first(params, "size")?.toLowerCase() ?? null,
    availability:
      availabilityRaw === "available" ||
      availabilityRaw === "reserved" ||
      availabilityRaw === "sold"
        ? availabilityRaw
        : null,
    minPrice: money(params, "min_price"),
    maxPrice: money(params, "max_price"),
    sort: (STOREFRONT_SORTS as readonly string[]).includes(sortRaw ?? "")
      ? (sortRaw as StorefrontSort)
      : "newest",
  };
}

/** Serialize active filters — stored as search_submit.parsed_filters. */
export function serializeFilters(
  filters: StorefrontFilters,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  if (filters.q) out.q = filters.q;
  if (filters.category) out.category = filters.category;
  if (filters.aesthetic) out.aesthetic = filters.aesthetic;
  if (filters.material) out.material = filters.material;
  if (filters.color) out.color = filters.color;
  if (filters.size) out.size = filters.size;
  if (filters.availability) out.availability = filters.availability;
  if (filters.minPrice !== null) out.min_price = filters.minPrice;
  if (filters.maxPrice !== null) out.max_price = filters.maxPrice;
  if (filters.sort !== "newest") out.sort = filters.sort;
  return out;
}

function textBlob(item: StorefrontItem): string {
  return [item.title, item.brand ?? "", item.description ?? ""]
    .join(" ")
    .toLowerCase();
}

function matchesQuery(item: StorefrontItem, q: string): boolean {
  const needle = q.toLowerCase();
  const blob = [
    textBlob(item),
    item.categoryLabel ?? "",
    ...item.tags.aesthetic,
    ...item.tags.material,
    ...item.tags.era,
    ...item.tags.silhouette,
  ].join(" ");
  // Every whitespace-separated term must appear (deterministic AND match).
  return needle
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => blob.includes(term));
}

/** Deterministic filter + text match over an already-published-scoped list. */
export function applyStorefrontFilters(
  items: StorefrontItem[],
  filters: StorefrontFilters,
): StorefrontItem[] {
  let out = items.filter((item) => {
    if (filters.q && !matchesQuery(item, filters.q)) return false;
    if (filters.category && item.categorySlug !== filters.category) return false;
    if (filters.aesthetic && !item.tags.aesthetic.includes(filters.aesthetic))
      return false;
    if (filters.material && !item.tags.material.includes(filters.material))
      return false;
    if (filters.color && !textBlob(item).includes(filters.color)) return false;
    if (
      filters.size &&
      !item.sizes.some((s) => s.toLowerCase() === filters.size)
    )
      return false;
    if (filters.availability && item.availability !== filters.availability)
      return false;
    if (filters.minPrice !== null) {
      if (item.priceSgd === null || item.priceSgd < filters.minPrice) return false;
    }
    if (filters.maxPrice !== null) {
      if (item.priceSgd === null || item.priceSgd > filters.maxPrice) return false;
    }
    return true;
  });

  out = [...out];
  switch (filters.sort) {
    case "price_asc":
      out.sort(
        (a, b) => (a.priceSgd ?? Infinity) - (b.priceSgd ?? Infinity),
      );
      break;
    case "price_desc":
      out.sort((a, b) => (b.priceSgd ?? -1) - (a.priceSgd ?? -1));
      break;
    case "title":
      out.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "newest":
    default:
      out.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
      break;
  }
  return out;
}

/**
 * Public visibility predicate (storefront scope: only published rows).
 * The SQL queries enforce the same rule; this predicate is the unit-testable
 * statement of it.
 */
export function isPubliclyVisible(row: {
  publishedAt: string | null;
}): boolean {
  return row.publishedAt !== null;
}
