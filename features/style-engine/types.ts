/**
 * Style Engine shared types (Build Bible §8.3–8.5). Pure module — every
 * function in this feature is deterministic, offline and unit-testable;
 * the AI adapter only re-words narrative text (never re-decides, §13.4).
 */

export type TaxonomyDimension =
  | "category"
  | "silhouette"
  | "proportion"
  | "material"
  | "palette_role"
  | "energy"
  | "era"
  | "aesthetic"
  | "climate"
  | "use";

export type Climate = "hot-humid" | "indoor-aircon" | "mild" | "cold";

export const CLIMATES: readonly Climate[] = [
  "hot-humid",
  "indoor-aircon",
  "mild",
  "cold",
];

/** One decoded attribute on a reference (manual tag or decoder output). */
export interface AttributeSignal {
  dimension: TaxonomyDimension;
  value: string; // tag slug, e.g. "boxy"
  /** 0–1; null = human-entered, treated as fully trusted. */
  confidence: number | null;
  source: "human" | "seller_provided" | "ai_suggestion" | "imported_metadata" | "rule";
}

/**
 * A garment the engine can reason about — catalog product, closet item or a
 * manually described piece. All attributes are tag slugs.
 */
export interface GarmentProfile {
  id: string;
  source: "catalog" | "closet" | "manual";
  label: string;
  category: string | null;
  silhouette: string[];
  material: string[];
  palette: string[];
  energy: string[];
  era: string[];
  /** Catalog price in SGD; null for closet/manual items. */
  priceSgd: number | null;
  /**
   * Catalog availability. Anything other than "available" is NEVER
   * recommended (§8.8 hallucinated_inventory guard) — closet items pass null.
   */
  availability: string | null;
}

export type CompatibilityVerdict =
  | "compatible"
  | "tension_but_usable"
  | "contradictory";

export interface DimensionAssessment {
  dimension:
    | "color"
    | "silhouette"
    | "proportion"
    | "material"
    | "formality"
    | "era"
    | "energy";
  /** 0 (clash) – 1 (harmonious). */
  score: number;
  note: string;
}

export interface CompatibilityResult {
  verdict: CompatibilityVerdict;
  score: number;
  assessments: DimensionAssessment[];
  repairMoves: string[];
}

export interface DecodedBreakdown {
  silhouette: { values: string[]; confidence: number; uncertain: boolean };
  palette: { values: string[]; confidence: number; uncertain: boolean };
  materials: {
    values: string[];
    confidence: number;
    uncertain: boolean;
    /** Breathable swaps for the Singapore climate (§8.5). */
    substitutes: string[];
  };
  era: { values: string[]; confidence: number; uncertain: boolean };
  energy: { values: string[]; confidence: number; uncertain: boolean };
  aesthetic: { values: string[]; confidence: number; uncertain: boolean };
  /** Signals that define the look vs attributes that happen to be present. */
  distinctive: string[];
  incidental: string[];
  /** Human-language notes; each starts from a rule, not vibes. */
  climateTranslation: string[];
  uncertainties: string[];
}

export interface BuildInput {
  /** 1–5 reference attribute sets (§8.3). */
  references: AttributeSignal[][];
  occasion: string;
  climate: Climate;
  budgetSgd: number | null;
  /** Silhouettes the wearer rejects outright. */
  avoidSilhouettes: string[];
  /** Closet ids the wearer explicitly wants incorporated. */
  ownedItemIds: string[];
  owned: GarmentProfile[];
  catalog: GarmentProfile[];
}

export interface Recommendation {
  item: GarmentProfile;
  role: string;
  explanation: string;
  /** 0–1, derived from deterministic signal matches. */
  confidence: number;
}

export interface RejectedCandidate {
  item: GarmentProfile;
  reason:
    | "over_budget"
    | "rejected_silhouette"
    | "climate_incompatible"
    | "unavailable";
  detail: string;
}

export interface BuildResult {
  sharedSignals: string[];
  contradictions: string[];
  thesis: string;
  thesisLines: string[];
  climateNotes: string[];
  recommendations: Recommendation[];
  rejected: RejectedCandidate[];
  confidence: number;
  /** True when no reference produced a usable signal. */
  insufficientSignal: boolean;
}

export type StyleMode = "build_my_fit" | "can_this_work" | "decode_reference";
