/**
 * Garment case-study assembly (§9.4) — pure module, unit-tested.
 *
 * The final case study CLEARLY separates simulated evidence (CLO renders,
 * fit maps, drape simulations) from physical evidence (wear tests, physical
 * prototypes). Discrepancies between the two are first-class content, not
 * footnotes — a simulation that disagreed with the body is the most
 * honest signal the lab produces.
 */

export type GarmentTestKind = "wear_test" | "clo_simulation" | "prototype_test";
export type GarmentAssetKind =
  | "flat"
  | "clo_project"
  | "render"
  | "fit_map"
  | "prototype_photo"
  | "before_photo";

export interface CaseStudyTest {
  kind: GarmentTestKind;
  tester_label: string | null;
  consent_obtained: boolean;
  context: string | null;
  feedback: string | null;
  discrepancies_vs_simulation: string | null;
  tested_at: string | null;
}

export interface CaseStudyAsset {
  kind: GarmentAssetKind;
  asset_path: string;
  version: number;
  /** What the image is intended to show (§9.4) — required honesty caption. */
  caption: string | null;
  ai_generation_id: string | null;
}

export interface Measurement {
  name: string;
  value: number;
  unit: string;
  method?: string | null;
}

export interface MeasurementComparison {
  name: string;
  unit: string;
  before: number | null;
  after: number | null;
  /** after - before; null when either side is missing. */
  delta: number | null;
}

export interface GarmentCaseStudy {
  title: string;
  problem_statement: string | null;
  problem_kind: string | null;
  before_notes: string | null;
  /** Simulated evidence only — CLO simulations, renders, fit maps. */
  simulated: {
    tests: CaseStudyTest[];
    assets: CaseStudyAsset[];
  };
  /** Physical evidence only — wear tests, prototype tests, photos. */
  physical: {
    tests: CaseStudyTest[];
    assets: CaseStudyAsset[];
  };
  /** Every recorded discrepancy between simulation and physical test. */
  discrepancies: string[];
  measurement_comparison: MeasurementComparison[];
  /** True when physical evidence exists — case study may claim "tested". */
  has_physical_evidence: boolean;
}

const SIMULATED_TEST_KINDS: readonly GarmentTestKind[] = ["clo_simulation"];
const SIMULATED_ASSET_KINDS: readonly GarmentAssetKind[] = ["clo_project", "render", "fit_map"];

/**
 * Compare before/after measurement sets by measurement name. Units must
 * match to compare; mismatched units are reported with a null delta rather
 * than silently converting.
 */
export function compareMeasurements(
  before: Measurement[],
  after: Measurement[],
): MeasurementComparison[] {
  const names = [...new Set([...before, ...after].map((m) => m.name))].sort();
  return names.map((name) => {
    const b = before.find((m) => m.name === name) ?? null;
    const a = after.find((m) => m.name === name) ?? null;
    const unit = a?.unit ?? b?.unit ?? "";
    const comparable = b !== null && a !== null && b.unit === a.unit;
    return {
      name,
      unit,
      before: b?.value ?? null,
      after: a?.value ?? null,
      delta: comparable ? round2((a?.value ?? 0) - (b?.value ?? 0)) : null,
    };
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Assemble the case study with the simulated/physical split enforced. */
export function assembleGarmentCaseStudy(input: {
  title: string;
  problem_statement: string | null;
  problem_kind: string | null;
  before_notes: string | null;
  tests: CaseStudyTest[];
  assets: CaseStudyAsset[];
  measurements_before: Measurement[];
  measurements_after: Measurement[];
}): GarmentCaseStudy {
  const simulatedTests = input.tests.filter((t) => SIMULATED_TEST_KINDS.includes(t.kind));
  const physicalTests = input.tests.filter((t) => !SIMULATED_TEST_KINDS.includes(t.kind));
  const simulatedAssets = input.assets.filter((a) => SIMULATED_ASSET_KINDS.includes(a.kind));
  const physicalAssets = input.assets.filter((a) => !SIMULATED_ASSET_KINDS.includes(a.kind));
  return {
    title: input.title,
    problem_statement: input.problem_statement,
    problem_kind: input.problem_kind,
    before_notes: input.before_notes,
    simulated: { tests: simulatedTests, assets: simulatedAssets },
    physical: { tests: physicalTests, assets: physicalAssets },
    discrepancies: input.tests
      .map((t) => t.discrepancies_vs_simulation)
      .filter((d): d is string => Boolean(d && d.trim())),
    measurement_comparison: compareMeasurements(
      input.measurements_before,
      input.measurements_after,
    ),
    has_physical_evidence: physicalTests.length > 0,
  };
}
