import { describe, expect, it } from "vitest";

import { parseQueryConstraints } from "@/features/storefront/query-parse";

const CATEGORIES = [
  { slug: "outerwear", label: "Outerwear" },
  { slug: "wide-leg-trousers", label: "Wide-leg trousers" },
  { slug: "dresses", label: "Dresses" },
];

describe("parseQueryConstraints (§9.3 deterministic fallback)", () => {
  it("extracts 'under $80' as a max price and keeps the free text", () => {
    const r = parseQueryConstraints("boxy jacket under $80", CATEGORIES);
    expect(r.maxPrice).toBe(80);
    expect(r.minPrice).toBeNull();
    expect(r.text).toBe("boxy jacket");
  });

  it("extracts min/max price phrases in several spellings", () => {
    expect(parseQueryConstraints("over 50 sgd dresses", CATEGORIES).minPrice).toBe(50);
    expect(parseQueryConstraints("up to $120", CATEGORIES).maxPrice).toBe(120);
    expect(parseQueryConstraints("less than $35.50", CATEGORIES).maxPrice).toBe(35.5);
    expect(parseQueryConstraints("at least $20", CATEGORIES).minPrice).toBe(20);
    expect(parseQueryConstraints("$60 or less", CATEGORIES).maxPrice).toBe(60);
    expect(parseQueryConstraints("$40 and up", CATEGORIES).minPrice).toBe(40);
  });

  it("matches category facet labels and slugs as whole words", () => {
    const byLabel = parseQueryConstraints("linen outerwear for humid days", CATEGORIES);
    expect(byLabel.category).toBe("outerwear");
    expect(byLabel.text).toBe("linen for humid days");

    const bySlug = parseQueryConstraints("wide-leg trousers under $90", CATEGORIES);
    expect(bySlug.category).toBe("wide-leg-trousers");
    expect(bySlug.maxPrice).toBe(90);
    expect(bySlug.text).toBeNull();
  });

  it("does not match category names inside other words", () => {
    const r = parseQueryConstraints("sun dresses", CATEGORIES);
    // "dresses" is a whole word here → matched; but "addressing" must not match.
    expect(r.category).toBe("dresses");
    expect(parseQueryConstraints("addressing fit issues", CATEGORIES).category).toBeNull();
  });

  it("leaves unconstrained queries untouched", () => {
    const r = parseQueryConstraints("cropped boxy jacket", CATEGORIES);
    expect(r).toEqual({
      text: "cropped boxy jacket",
      minPrice: null,
      maxPrice: null,
      category: null,
    });
  });

  it("ignores implausible prices", () => {
    expect(parseQueryConstraints("under $99999999", CATEGORIES).maxPrice).toBeNull();
  });
});
