import { describe, expect, it } from "vitest";

import {
  applyStorefrontFilters,
  EMPTY_FILTERS,
  isPubliclyVisible,
  parseStorefrontFilters,
  serializeFilters,
  type StorefrontItem,
} from "@/features/storefront/filters";
import { ownershipWording } from "@/features/storefront/ownership";

function item(partial: Partial<StorefrontItem> & { id: string }): StorefrontItem {
  return {
    slug: `slug-${partial.id}`,
    title: `Item ${partial.id}`,
    brand: null,
    description: null,
    priceSgd: 50,
    availability: "available",
    conditionGrade: "good",
    categorySlug: "outerwear",
    categoryLabel: "Outerwear",
    tags: { aesthetic: [], material: [], era: [], silhouette: [] },
    sizes: [],
    publishedAt: "2026-08-14T12:00:00.000Z",
    ...partial,
  };
}

const CATALOG: StorefrontItem[] = [
  item({
    id: "p1",
    title: "Cropped Boxy Denim Jacket",
    brand: "Levi's (vintage)",
    priceSgd: 68,
    tags: { aesthetic: ["workwear"], material: ["denim"], era: ["90s"], silhouette: ["cropped", "boxy"] },
    sizes: ["M"],
    publishedAt: "2026-08-14T12:00:00.000Z",
  }),
  item({
    id: "p2",
    title: "Oversized Long Wool Coat",
    priceSgd: 120,
    categorySlug: "outerwear",
    tags: { aesthetic: ["minimal"], material: ["wool"], era: [], silhouette: ["oversized"] },
    publishedAt: "2026-08-15T12:00:00.000Z",
  }),
  item({
    id: "p3",
    title: "Pleated Wide Trousers",
    description: "Black pleated trousers.",
    priceSgd: 58,
    categorySlug: "trouser",
    categoryLabel: "Trouser",
    availability: "sold",
    tags: { aesthetic: ["tailored"], material: [], era: [], silhouette: ["wide"] },
    publishedAt: "2026-08-13T12:00:00.000Z",
  }),
  item({
    id: "p4",
    title: "No-price mystery piece",
    priceSgd: null,
    availability: "reserved",
  }),
];

describe("storefront scoping (§8.1: published-only)", () => {
  it("isPubliclyVisible requires published_at", () => {
    expect(isPubliclyVisible({ publishedAt: "2026-08-14T12:00:00Z" })).toBe(true);
    expect(isPubliclyVisible({ publishedAt: null })).toBe(false);
  });

  it("draft rows never survive scoping", () => {
    const rows = [
      { publishedAt: "2026-08-14T12:00:00Z" },
      { publishedAt: null },
    ];
    expect(rows.filter(isPubliclyVisible)).toHaveLength(1);
  });
});

describe("storefront filters (§8.1)", () => {
  it("filters by price band, excluding priceless items", () => {
    const out = applyStorefrontFilters(CATALOG, {
      ...EMPTY_FILTERS,
      minPrice: 50,
      maxPrice: 70,
    });
    expect(out.map((i) => i.id).sort()).toEqual(["p1", "p3"]);
  });

  it("filters by category and availability", () => {
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, category: "trouser" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p3"]);
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, availability: "sold" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p3"]);
    expect(
      applyStorefrontFilters(CATALOG, {
        ...EMPTY_FILTERS,
        availability: "available",
      }).map((i) => i.id),
    ).toEqual(["p2", "p1"]); // default sort = newest (p2 published later)
  });

  it("filters by aesthetic and material tags", () => {
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, aesthetic: "workwear" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p1"]);
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, material: "wool" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p2"]);
  });

  it("filters by structured size labels and colour text match", () => {
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, size: "m" }).map((i) => i.id),
    ).toEqual(["p1"]);
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, color: "black" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p3"]);
  });

  it("text query matches title/brand/tags with AND semantics", () => {
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, q: "cropped denim" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p1"]);
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, q: "vintage levi" }).map(
        (i) => i.id,
      ),
    ).toEqual(["p1"]);
    expect(
      applyStorefrontFilters(CATALOG, { ...EMPTY_FILTERS, q: "cropped wool" }),
    ).toHaveLength(0);
  });

  it("sorts by price asc/desc, title, newest", () => {
    const byAsc = applyStorefrontFilters(CATALOG, {
      ...EMPTY_FILTERS,
      sort: "price_asc",
    }).map((i) => i.id);
    expect(byAsc).toEqual(["p3", "p1", "p2", "p4"]); // 58, 68, 120, priceless last

    const byDesc = applyStorefrontFilters(CATALOG, {
      ...EMPTY_FILTERS,
      sort: "price_desc",
    }).map((i) => i.id);
    expect(byDesc[0]).toBe("p2");

    const byTitle = applyStorefrontFilters(CATALOG, {
      ...EMPTY_FILTERS,
      sort: "title",
    }).map((i) => i.title);
    expect([...byTitle]).toEqual([...byTitle].sort((a, b) => a.localeCompare(b)));

    const byNewest = applyStorefrontFilters(CATALOG, {
      ...EMPTY_FILTERS,
      sort: "newest",
    }).map((i) => i.id);
    expect(byNewest[0]).toBe("p2");
  });
});

describe("filter param parsing (server-side query params)", () => {
  it("parses valid params and drops junk", () => {
    const filters = parseStorefrontFilters({
      q: " jacket ",
      category: "Outerwear",
      min_price: "20",
      max_price: "abc",
      availability: "stolen",
      sort: "price_desc",
    });
    expect(filters.q).toBe("jacket");
    expect(filters.category).toBe("outerwear");
    expect(filters.minPrice).toBe(20);
    expect(filters.maxPrice).toBeNull(); // non-numeric dropped
    expect(filters.availability).toBeNull(); // invalid value dropped
    expect(filters.sort).toBe("price_desc");
  });

  it("unknown sort falls back to newest; negative price dropped", () => {
    const filters = parseStorefrontFilters({ sort: "cheapest!!", min_price: "-5" });
    expect(filters.sort).toBe("newest");
    expect(filters.minPrice).toBeNull();
  });

  it("serializes only active filters (search_submit.parsed_filters)", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toEqual({});
    expect(
      serializeFilters({ ...EMPTY_FILTERS, q: "coat", maxPrice: 100, sort: "newest" }),
    ).toEqual({ q: "coat", max_price: 100 });
  });
});

describe("ownership wording (§10.5 product truth)", () => {
  it("owned/consigned sell via checkout; referral goes outbound", () => {
    expect(ownershipWording("owned").purchaseMode).toBe("checkout");
    expect(ownershipWording("permission_consignment").purchaseMode).toBe("checkout");
    expect(ownershipWording("permission_referral").purchaseMode).toBe("referral");
    expect(ownershipWording("borrowed_for_content").purchaseMode).toBe("none");
  });

  it("referral wording states the seller fulfils and FitArchive takes no payment", () => {
    const w = ownershipWording("permission_referral");
    expect(w.description).toContain("external seller");
    expect(w.description).toContain("never takes payment");
  });

  it("unknown/missing ownership is not purchasable", () => {
    expect(ownershipWording(null).purchaseMode).toBe("none");
    expect(ownershipWording("something_else").purchaseMode).toBe("none");
  });
});
