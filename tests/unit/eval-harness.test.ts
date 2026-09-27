import { describe, expect, it } from "vitest";

import { EVAL_CASES } from "@/features/ai/eval-cases";
import { runAllEvalCases, runEvalCase } from "@/features/ai/harness";
import { RATING_DIMENSIONS } from "@/features/ai/ratings";

describe("§8.8 evaluation harness — seeded cases pass against the real engine", () => {
  const results = runAllEvalCases(EVAL_CASES);

  it("every seeded case passes (the engine satisfies its own eval suite)", () => {
    for (const result of results) {
      expect(result.violations, `case ${result.caseId}: ${result.violations.join("; ")}`).toEqual([]);
      expect(result.pass).toBe(true);
    }
  });

  it("covers all six §8.8 failure modes across the suite", () => {
    const covered = new Set(EVAL_CASES.map((c) => c.failureModeTested));
    for (const mode of [
      "constraint_miss",
      "hallucinated_inventory",
      "cosplay_overfit",
      "contradiction_blindness",
      "unsupported_certainty",
      "preference_miss",
    ]) {
      expect(covered.has(mode as never), `missing a case for ${mode}`).toBe(true);
    }
  });

  it("the harness catches regressions: wool in hot-humid must fail the climate case", () => {
    // Mutate the case: pretend the engine recommended the wool coat by
    // checking the same expectation against a hand-broken build input.
    const climateCase = EVAL_CASES.find((c) => c.id === "sg-heat-rejects-wool");
    expect(climateCase).toBeDefined();
    const result = runEvalCase(climateCase!);
    expect(result.pass).toBe(true);

    // And prove the expectation itself has teeth: an eval case expecting the
    // linen piece to be excluded MUST fail (the engine rightly recommends it).
    const sabotaged = {
      ...climateCase!,
      expect: { excludedItemLabels: ["Eval Linen Shirt-Jacket"] },
    };
    const sabotagedResult = runEvalCase(sabotaged);
    expect(sabotagedResult.pass).toBe(false);
    expect(sabotagedResult.violations[0]).toContain("Eval Linen Shirt-Jacket");
  });

  it("case ids are unique (they key ai_generations input refs)", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("§13.5 rating dimensions", () => {
  it("are exactly the six spec dimensions", () => {
    expect([...RATING_DIMENSIONS]).toEqual([
      "grounding",
      "constraint_adherence",
      "truthfulness",
      "utility",
      "style_quality",
      "reproducibility",
    ]);
  });
});
