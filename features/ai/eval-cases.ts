import type { AttributeSignal, BuildInput, CompatibilityVerdict, GarmentProfile, StyleMode } from "@/features/style-engine/types";

/**
 * AI Lab evaluation cases (§8.8) — authored test cases with expected
 * constraints. The harness (./harness) runs each case against the real
 * deterministic engine and, when asked, the active AI provider's structured
 * contract. Failure modes are the §8.8 enum exactly:
 * constraint_miss · hallucinated_inventory · cosplay_overfit ·
 * contradiction_blindness · unsupported_certainty · preference_miss.
 */

export type FailureMode =
  | "constraint_miss"
  | "hallucinated_inventory"
  | "cosplay_overfit"
  | "contradiction_blindness"
  | "unsupported_certainty"
  | "preference_miss";

export interface EvalCase {
  id: string;
  mode: StyleMode;
  title: string;
  /** What §8.8 failure mode a regression here would indicate. */
  failureModeTested: FailureMode;
  description: string;
  input:
    | { kind: "build"; build: BuildInput }
    | {
        kind: "compatibility";
        itemA: GarmentProfile;
        itemB: GarmentProfile;
      }
    | {
        kind: "decode";
        attributes: Array<{
          dimension: "silhouette" | "palette_role" | "material" | "era" | "energy" | "aesthetic";
          value: string;
          confidence: number | null;
          source: "human" | "ai_suggestion";
        }>;
      };
  expect: {
    /** Labels that must NOT appear in recommendations/matches. */
    excludedItemLabels?: string[];
    /** No recommendation may exceed this price. */
    maxPriceSgd?: number;
    /** Result must surface at least one contradiction note. */
    requiresContradictionNote?: boolean;
    /** Result confidence must not exceed this (certainty discipline). */
    maxConfidence?: number;
    /** Compatibility verdict must equal this. */
    expectedVerdict?: CompatibilityVerdict;
    /** Result must offer at least one repair move / climate swap. */
    requiresRepairMoves?: boolean;
  };
}

/* ------------------------------ fixtures -------------------------------- */

function garment(partial: Partial<GarmentProfile> & { id: string; label: string }): GarmentProfile {
  return {
    source: "catalog",
    category: null,
    silhouette: [],
    material: [],
    palette: [],
    energy: [],
    era: [],
    priceSgd: null,
    availability: "available",
    ...partial,
  };
}

const REF_BOXY_MONO: AttributeSignal[] = [
  { dimension: "silhouette", value: "boxy", confidence: 0.9, source: "human" },
  { dimension: "palette_role", value: "monochrome", confidence: 0.9, source: "human" },
  { dimension: "energy", value: "clean", confidence: 0.8, source: "human" },
];
const REF_CROPPED_MONO: AttributeSignal[] = [
  { dimension: "silhouette", value: "cropped", confidence: 0.85, source: "human" },
  { dimension: "palette_role", value: "monochrome", confidence: 0.9, source: "human" },
  { dimension: "energy", value: "clean", confidence: 0.8, source: "human" },
];

function buildInput(overrides: Partial<BuildInput>): BuildInput {
  return {
    references: [REF_BOXY_MONO, REF_CROPPED_MONO],
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

/* -------------------------------- cases ---------------------------------- */

export const EVAL_CASES: readonly EvalCase[] = [
  {
    id: "sg-heat-rejects-wool",
    mode: "build_my_fit",
    title: "Singapore heat rejects wool layering",
    failureModeTested: "constraint_miss",
    description:
      "Hot-humid climate: a perfectly on-signal, available, in-budget wool layer must still be excluded — with a named climate reason.",
    input: {
      kind: "build",
      build: buildInput({
        catalog: [
          garment({
            id: "eval-wool-coat",
            label: "Eval Wool Overcoat",
            category: "outerwear",
            silhouette: ["boxy"],
            palette: ["monochrome"],
            energy: ["clean"],
            material: ["wool"],
            priceSgd: 80,
          }),
          garment({
            id: "eval-linen-shirt",
            label: "Eval Linen Shirt-Jacket",
            category: "outerwear",
            silhouette: ["boxy"],
            palette: ["monochrome"],
            energy: ["clean"],
            material: ["linen"],
            priceSgd: 65,
          }),
        ],
      }),
    },
    expect: { excludedItemLabels: ["Eval Wool Overcoat"] },
  },
  {
    id: "sold-item-never-recommended",
    mode: "build_my_fit",
    title: "Unavailable inventory is never recommended",
    failureModeTested: "hallucinated_inventory",
    description:
      "A sold item with perfect signal overlap must not surface as a recommendation — the engine may only offer what exists.",
    input: {
      kind: "build",
      build: buildInput({
        catalog: [
          garment({
            id: "eval-sold-hero",
            label: "Eval Sold Boxy Blazer",
            category: "outerwear",
            silhouette: ["boxy"],
            palette: ["monochrome"],
            energy: ["clean"],
            material: ["linen"],
            priceSgd: 70,
            availability: "sold",
          }),
        ],
      }),
    },
    expect: { excludedItemLabels: ["Eval Sold Boxy Blazer"] },
  },
  {
    id: "budget-cap-respected",
    mode: "build_my_fit",
    title: "Budget is a hard ceiling",
    failureModeTested: "constraint_miss",
    description:
      "With a SGD 50 budget, a SGD 120 on-signal piece must be rejected with an over-budget reason, never recommended.",
    input: {
      kind: "build",
      build: buildInput({
        budgetSgd: 50,
        catalog: [
          garment({
            id: "eval-expensive",
            label: "Eval Premium Boxy Jacket",
            category: "outerwear",
            silhouette: ["boxy"],
            palette: ["monochrome"],
            energy: ["clean"],
            material: ["linen"],
            priceSgd: 120,
          }),
        ],
      }),
    },
    expect: { excludedItemLabels: ["Eval Premium Boxy Jacket"], maxPriceSgd: 50 },
  },
  {
    id: "rejected-silhouette-excluded",
    mode: "build_my_fit",
    title: "Rejected silhouettes stay excluded",
    failureModeTested: "preference_miss",
    description:
      "The wearer ruled out oversized; an oversized on-signal piece must be excluded even when it matches every reference.",
    input: {
      kind: "build",
      build: buildInput({
        avoidSilhouettes: ["oversized"],
        catalog: [
          garment({
            id: "eval-oversized",
            label: "Eval Oversized Coat",
            category: "outerwear",
            silhouette: ["oversized", "boxy"],
            palette: ["monochrome"],
            energy: ["clean"],
            material: ["cotton"],
            priceSgd: 60,
          }),
        ],
      }),
    },
    expect: { excludedItemLabels: ["Eval Oversized Coat"] },
  },
  {
    id: "contradiction-is-named",
    mode: "build_my_fit",
    title: "Contradictory references are surfaced, not smoothed over",
    failureModeTested: "contradiction_blindness",
    description:
      "Fitted + oversized and monochrome + high-contrast in one reference pool must produce explicit contradiction notes.",
    input: {
      kind: "build",
      build: buildInput({
        references: [
          [
            { dimension: "silhouette", value: "fitted", confidence: 0.9, source: "human" },
            { dimension: "palette_role", value: "monochrome", confidence: 0.9, source: "human" },
          ],
          [
            { dimension: "silhouette", value: "oversized", confidence: 0.9, source: "human" },
            { dimension: "palette_role", value: "high-contrast", confidence: 0.9, source: "human" },
          ],
        ],
      }),
    },
    expect: { requiresContradictionNote: true },
  },
  {
    id: "low-confidence-decode-stays-uncertain",
    mode: "decode_reference",
    title: "Low-confidence reads stay uncertain",
    failureModeTested: "unsupported_certainty",
    description:
      "A reference decoded only from low-confidence AI suggestions must flag uncertainty instead of asserting.",
    input: {
      kind: "decode",
      attributes: [
        { dimension: "silhouette", value: "draped", confidence: 0.4, source: "ai_suggestion" },
        { dimension: "era", value: "vintage-uncertain", confidence: 0.35, source: "ai_suggestion" },
      ],
    },
    expect: { maxConfidence: 0.6 },
  },
  {
    id: "era-clash-is-not-compatible",
    mode: "can_this_work",
    title: "Costume-risk era clash is flagged with repair moves",
    failureModeTested: "cosplay_overfit",
    description:
      "70s disco shirt × contemporary techwear trouser with clashing energies must not return 'compatible', and must offer repair moves.",
    input: {
      kind: "compatibility",
      itemA: garment({
        id: "eval-70s-shirt",
        label: "Eval 70s Disco Shirt",
        category: "shirt",
        silhouette: ["fitted"],
        material: ["polyester"],
        palette: ["jewel"],
        energy: ["playful"],
        era: ["70s"],
      }),
      itemB: garment({
        id: "eval-tech-trouser",
        label: "Eval Techwear Trouser",
        category: "trouser",
        silhouette: ["tapered"],
        material: ["nylon"],
        palette: ["metallic"],
        energy: ["futuristic"],
        era: ["contemporary"],
      }),
    },
    expect: { expectedVerdict: "tension_but_usable", requiresRepairMoves: true },
  },
  {
    id: "clean-pair-is-compatible",
    mode: "can_this_work",
    title: "Balanced pairing returns compatible",
    failureModeTested: "preference_miss",
    description:
      "Cropped linen shirt over wide cotton trouser, both neutral/clean — the sanity case that must stay 'compatible'.",
    input: {
      kind: "compatibility",
      itemA: garment({
        id: "eval-crop-shirt",
        label: "Eval Cropped Linen Shirt",
        category: "shirt",
        silhouette: ["cropped"],
        material: ["linen"],
        palette: ["neutral"],
        energy: ["clean"],
        era: ["contemporary"],
      }),
      itemB: garment({
        id: "eval-wide-trouser",
        label: "Eval Wide Cotton Trouser",
        category: "trouser",
        silhouette: ["wide"],
        material: ["cotton"],
        palette: ["neutral"],
        energy: ["clean"],
        era: ["contemporary"],
      }),
    },
    expect: { expectedVerdict: "compatible" },
  },
];
