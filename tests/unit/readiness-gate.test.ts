import { describe, expect, it } from "vitest";

import {
  evaluateReadiness,
  type ReadinessInput,
  type ReadinessItemInput,
} from "@/features/drops/readiness";

function passItem(overrides: Partial<ReadinessItemInput> = {}): ReadinessItemInput {
  return {
    productId: "p1",
    title: "FA-001 jacket",
    tier: "core",
    effectivePriceSgd: 55,
    conditionGrade: "excellent",
    measurementCount: 3,
    publicAssetCount: 2,
    descriptionPublic: "Boxy cropped work jacket, washed black.",
    ownershipState: "owned",
    permission: null,
    fulfillmentResponsibility: null,
    returnTerms: null,
    assetsMissingRightsNote: 0,
    availability: "available",
    ...overrides,
  };
}

function passingInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    concept: "Cropped outerwear for the wet season",
    itemCount: 3,
    targetSizeMin: 3,
    targetSizeMax: 12,
    items: [
      passItem({ productId: "p1", tier: "hero", effectivePriceSgd: 90 }),
      passItem({ productId: "p2", tier: "core" }),
      passItem({ productId: "p3", tier: "entry", effectivePriceSgd: 35 }),
    ],
    trackedLinkCount: 2,
    metricDefinitionsCount: 11,
    dropEventCount: 5,
    attestations: { personas: true, rollback: true },
    now: new Date("2026-09-01T00:00:00Z"),
    ...overrides,
  };
}

describe("readiness gate (§10.2 — 16 checks)", () => {
  it("evaluates exactly 16 checks", () => {
    const result = evaluateReadiness(passingInput());
    expect(result.checks).toHaveLength(16);
  });

  it("passes a fully prepared drop with attestations", () => {
    const result = evaluateReadiness(passingInput());
    expect(result.passed).toBe(true);
    expect(result.failedCount).toBe(0);
  });

  it("fails without operator attestations (personas + rollback)", () => {
    const result = evaluateReadiness(
      passingInput({ attestations: { personas: false, rollback: false } }),
    );
    expect(result.passed).toBe(false);
    const failedKeys = result.checks.filter((c) => !c.passed).map((c) => c.key);
    expect(failedKeys).toEqual(["personas", "rollback"]);
  });

  it("blocks when a non-owned item lacks valid permission", () => {
    const result = evaluateReadiness(
      passingInput({
        items: [
          passItem({ tier: "hero" }),
          passItem({ productId: "p2", tier: "core" }),
          passItem({
            productId: "p3",
            tier: "entry",
            ownershipState: "observed_only",
            permission: null,
          }),
        ],
      }),
    );
    const permCheck = result.checks.find((c) => c.key === "permissions");
    expect(permCheck?.passed).toBe(false);
    expect(permCheck?.detail).toMatch(/p3|FA-001/);
    expect(result.passed).toBe(false);
  });

  it("blocks when assortment size is outside the target range", () => {
    const result = evaluateReadiness(passingInput({ itemCount: 1 }));
    expect(result.checks.find((c) => c.key === "size")?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it("blocks when tier spread lacks entry or hero", () => {
    const result = evaluateReadiness(
      passingInput({
        items: [passItem({ tier: "core" }), passItem({ productId: "p2", tier: "core" })],
      }),
    );
    expect(result.checks.find((c) => c.key === "tiers")?.passed).toBe(false);
  });

  it("blocks on missing measurements, price, description, imagery", () => {
    const bad = passItem({
      tier: "hero",
      measurementCount: 0,
      conditionGrade: null,
      effectivePriceSgd: null,
      descriptionPublic: "",
      publicAssetCount: 0,
    });
    const result = evaluateReadiness(
      passingInput({
        items: [bad, passItem({ productId: "p2", tier: "core" }), passItem({ productId: "p3", tier: "entry" })],
      }),
    );
    for (const key of ["measurements_condition", "pricing", "descriptions", "assets"]) {
      expect(result.checks.find((c) => c.key === key)?.passed).toBe(false);
    }
  });

  it("blocks without tracked links or test events", () => {
    const result = evaluateReadiness(
      passingInput({ trackedLinkCount: 0, dropEventCount: 0 }),
    );
    expect(result.checks.find((c) => c.key === "tracked_links")?.passed).toBe(false);
    expect(result.checks.find((c) => c.key === "test_events")?.passed).toBe(false);
  });

  it("blocks consigned items without fulfillment/returns wording", () => {
    const result = evaluateReadiness(
      passingInput({
        items: [
          passItem({ tier: "hero" }),
          passItem({ productId: "p2", tier: "core" }),
          passItem({
            productId: "p3",
            tier: "entry",
            ownershipState: "permission_consignment",
            permission: { state: "permission_consignment", granted_at: "2026-08-01T00:00:00Z" },
            fulfillmentResponsibility: null,
            returnTerms: null,
          }),
        ],
      }),
    );
    expect(result.checks.find((c) => c.key === "fulfillment")?.passed).toBe(false);
    expect(result.checks.find((c) => c.key === "returns_wording")?.passed).toBe(false);
  });

  it("blocks on undocumented seller media rights", () => {
    const result = evaluateReadiness(
      passingInput({
        items: [
          passItem({ tier: "hero", assetsMissingRightsNote: 1 }),
          passItem({ productId: "p2", tier: "core" }),
          passItem({ productId: "p3", tier: "entry" }),
        ],
      }),
    );
    expect(result.checks.find((c) => c.key === "media_rights")?.passed).toBe(false);
  });
});
