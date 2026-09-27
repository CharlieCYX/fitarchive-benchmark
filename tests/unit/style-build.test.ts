import { describe, expect, it } from "vitest";

import { buildMyFit, matchGarments } from "@/features/style-engine/build";
import type { AttributeSignal, BuildInput, GarmentProfile } from "@/features/style-engine/types";

function garment(partial: Partial<GarmentProfile> & { id: string; label: string }): GarmentProfile {
  return {
    source: "catalog",
    category: "outerwear",
    silhouette: ["boxy"],
    material: ["linen"],
    palette: ["monochrome"],
    energy: ["clean"],
    era: ["contemporary"],
    priceSgd: 60,
    availability: "available",
    ...partial,
  };
}

const REFERENCES: AttributeSignal[][] = [
  [
    { dimension: "silhouette", value: "boxy", confidence: 0.9, source: "human" },
    { dimension: "palette_role", value: "monochrome", confidence: 0.9, source: "human" },
  ],
  [
    { dimension: "silhouette", value: "boxy", confidence: 0.85, source: "human" },
    { dimension: "palette_role", value: "monochrome", confidence: 0.85, source: "human" },
    { dimension: "energy", value: "clean", confidence: 0.8, source: "human" },
  ],
];

function input(overrides: Partial<BuildInput>): BuildInput {
  return {
    references: REFERENCES,
    occasion: "daily",
    climate: "hot-humid",
    budgetSgd: null,
    avoidSilhouettes: [],
    ownedItemIds: [],
    owned: [],
    catalog: [],
    ...overrides,
  };
}

describe("Build My Fit — hard constraints (§8.3, §8.8)", () => {
  it("rejects wool layering in hot-humid, names the climate reason", () => {
    const result = buildMyFit(
      input({
        catalog: [
          garment({ id: "wool", label: "Wool Coat", material: ["wool"] }),
          garment({ id: "linen", label: "Linen Layer", material: ["linen"] }),
        ],
      }),
    );
    const labels = result.recommendations.map((r) => r.item.label);
    expect(labels).not.toContain("Wool Coat");
    expect(labels).toContain("Linen Layer");
    const woolRejection = result.rejected.find((r) => r.item.label === "Wool Coat");
    expect(woolRejection?.reason).toBe("climate_incompatible");
  });

  it("never recommends unavailable items (hallucinated_inventory guard)", () => {
    const result = buildMyFit(
      input({
        catalog: [
          garment({ id: "sold", label: "Sold Hero", availability: "sold" }),
          garment({ id: "reserved", label: "Reserved One", availability: "reserved" }),
          garment({ id: "draft", label: "Draft Piece", availability: "draft" }),
          garment({ id: "ok", label: "Available One" }),
        ],
      }),
    );
    const labels = result.recommendations.map((r) => r.item.label);
    expect(labels).toEqual(["Available One"]);
    expect(result.rejected.map((r) => r.reason)).toEqual([
      "unavailable",
      "unavailable",
      "unavailable",
    ]);
  });

  it("budget is a hard ceiling", () => {
    const result = buildMyFit(
      input({
        budgetSgd: 50,
        catalog: [
          garment({ id: "cheap", label: "In Budget", priceSgd: 45 }),
          garment({ id: "pricey", label: "Over Budget", priceSgd: 120 }),
        ],
      }),
    );
    const labels = result.recommendations.map((r) => r.item.label);
    expect(labels).toContain("In Budget");
    expect(labels).not.toContain("Over Budget");
    expect(result.rejected.find((r) => r.item.label === "Over Budget")?.reason).toBe("over_budget");
  });

  it("rejected silhouettes are excluded absolutely", () => {
    const result = buildMyFit(
      input({
        avoidSilhouettes: ["boxy"],
        catalog: [garment({ id: "boxy", label: "Boxy Jacket" })],
      }),
    );
    expect(result.recommendations).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("rejected_silhouette");
  });

  it("owned items are preferred over equivalent catalog items", () => {
    const result = buildMyFit(
      input({
        owned: [
          garment({ id: "closet-1", label: "My Own Layer", source: "closet", priceSgd: null, availability: null }),
        ],
        catalog: [garment({ id: "cat-1", label: "Catalog Layer" })],
      }),
    );
    // Same role (layer): the owned item must win.
    const layer = result.recommendations.find((r) => r.role === "layer");
    expect(layer?.item.source).toBe("closet");
  });

  it("detects contradictions instead of smoothing them over", () => {
    const result = buildMyFit(
      input({
        references: [
          [{ dimension: "silhouette", value: "fitted", confidence: 0.9, source: "human" }],
          [{ dimension: "silhouette", value: "oversized", confidence: 0.9, source: "human" }],
        ],
      }),
    );
    expect(result.contradictions.length).toBeGreaterThan(0);
    expect(result.contradictions[0]).toMatch(/fitted.*oversized|volume/i);
  });

  it("thin signal produces an honest insufficient-signal thesis", () => {
    const result = buildMyFit(
      input({
        references: [
          [{ dimension: "era", value: "90s", confidence: 0.9, source: "human" }],
        ],
      }),
    );
    expect(result.insufficientSignal).toBe(true);
    expect(result.confidence).toBe(0.25);
    expect(result.thesis).toMatch(/don't agree enough|add one more/i);
  });

  it("is deterministic — identical inputs give identical outputs", () => {
    const a = buildMyFit(input({ catalog: [garment({ id: "x", label: "X" })] }));
    const b = buildMyFit(input({ catalog: [garment({ id: "x", label: "X" })] }));
    expect(a).toEqual(b);
  });

  it("confidence drops when contradictions are present", () => {
    const clean = buildMyFit(input({ catalog: [garment({ id: "x", label: "X" })] }));
    const conflicted = buildMyFit(
      input({
        catalog: [garment({ id: "x", label: "X" })],
        references: [
          ...REFERENCES,
          [{ dimension: "palette_role", value: "high-contrast", confidence: 0.9, source: "human" }],
        ],
      }),
    );
    expect(conflicted.confidence).toBeLessThan(clean.confidence);
  });
});

describe("matchGarments (§8.5 decode matches)", () => {
  it("never matches sold catalog items, ranks owned first on ties", () => {
    const matches = matchGarments(
      ["silhouette:boxy"],
      [
        garment({ id: "sold", label: "Sold", availability: "sold" }),
        garment({ id: "cat", label: "Catalog Boxy" }),
        garment({ id: "own", label: "Closet Boxy", source: "closet", priceSgd: null, availability: null }),
      ],
    );
    const labels = matches.map((m) => m.item.label);
    expect(labels).not.toContain("Sold");
    expect(labels[0]).toBe("Closet Boxy");
  });
});
