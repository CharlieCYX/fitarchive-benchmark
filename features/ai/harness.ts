import { buildMyFit } from "@/features/style-engine/build";
import { assessCompatibility } from "@/features/style-engine/compatibility";
import { decodeReference } from "@/features/style-engine/decode";
import type { EvalCase } from "./eval-cases";

/**
 * Evaluation harness (§8.8) — pure. Runs an authored case against the real
 * deterministic engine and checks every expected constraint. The same
 * harness backs /studio/ai-lab runs and the vitest suite, so the UI can
 * never drift from the tests.
 */

export interface EvalRunResult {
  caseId: string;
  pass: boolean;
  violations: string[];
  /** Short human summary of what the engine actually did. */
  engineSummary: string;
}

export function runEvalCase(evalCase: EvalCase): EvalRunResult {
  const violations: string[] = [];
  let engineSummary = "";

  if (evalCase.input.kind === "build") {
    const result = buildMyFit(evalCase.input.build);
    const recommendedLabels = result.recommendations.map((r) => r.item.label);
    for (const label of evalCase.expect.excludedItemLabels ?? []) {
      if (recommendedLabels.includes(label)) {
        violations.push(`"${label}" was recommended but must be excluded (${evalCase.failureModeTested}).`);
      }
    }
    if (evalCase.expect.maxPriceSgd !== undefined) {
      for (const rec of result.recommendations) {
        if (
          rec.item.priceSgd !== null &&
          rec.item.priceSgd > evalCase.expect.maxPriceSgd
        ) {
          violations.push(
            `"${rec.item.label}" at SGD ${rec.item.priceSgd} exceeds the ${evalCase.expect.maxPriceSgd} budget.`,
          );
        }
      }
    }
    if (evalCase.expect.requiresContradictionNote && result.contradictions.length === 0) {
      violations.push("Expected at least one contradiction note; the engine surfaced none.");
    }
    if (evalCase.expect.maxConfidence !== undefined && result.confidence > evalCase.expect.maxConfidence) {
      violations.push(`Confidence ${result.confidence} exceeds the allowed ${evalCase.expect.maxConfidence}.`);
    }
    engineSummary = `${result.recommendations.length} recommendation(s), ${result.rejected.length} rejected, ${result.contradictions.length} contradiction note(s), confidence ${result.confidence}.`;
  } else if (evalCase.input.kind === "compatibility") {
    const result = assessCompatibility(evalCase.input.itemA, evalCase.input.itemB);
    if (
      evalCase.expect.expectedVerdict !== undefined &&
      result.verdict !== evalCase.expect.expectedVerdict
    ) {
      violations.push(`Verdict "${result.verdict}" ≠ expected "${evalCase.expect.expectedVerdict}".`);
    }
    if (evalCase.expect.requiresRepairMoves && result.repairMoves.length === 0) {
      violations.push("Expected repair moves; none were offered.");
    }
    engineSummary = `Verdict ${result.verdict} (score ${result.score}), ${result.repairMoves.length} repair move(s).`;
  } else {
    const result = decodeReference(
      evalCase.input.attributes.map((a) => ({ ...a })),
    );
    if (evalCase.expect.maxConfidence !== undefined) {
      const confidences = [
        result.silhouette.confidence,
        result.palette.confidence,
        result.materials.confidence,
        result.era.confidence,
      ].filter((c) => c > 0);
      for (const c of confidences) {
        if (c > evalCase.expect.maxConfidence) {
          violations.push(`A dimension read confidence ${c} exceeds ${evalCase.expect.maxConfidence}.`);
        }
      }
      if (result.uncertainties.length === 0) {
        violations.push("Expected uncertainty flags on low-confidence reads; none were raised.");
      }
    }
    engineSummary = `${result.distinctive.length} distinctive / ${result.incidental.length} incidental signal(s), ${result.uncertainties.length} uncertainty note(s).`;
  }

  return {
    caseId: evalCase.id,
    pass: violations.length === 0,
    violations,
    engineSummary,
  };
}

export function runAllEvalCases(cases: readonly EvalCase[]): EvalRunResult[] {
  return cases.map(runEvalCase);
}
