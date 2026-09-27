import { describe, expect, it } from "vitest";

import { MockAIProvider } from "@/lib/ai/provider";
import { latestPromptFor } from "@/lib/ai/prompts";
import {
  buildIdeationRound,
  ideationOutputSchema,
  ideationProvenanceIssues,
} from "@/features/garment-lab/ideation";
import {
  assembleGarmentCaseStudy,
  compareMeasurements,
} from "@/features/garment-lab/case-study";

describe("ideation round provenance (§9.4 + §13.3)", () => {
  it("numbers rounds sequentially per project", () => {
    const base = {
      garmentProjectId: "g1",
      promptText: "Propose three pocket constructions…",
      referenceNotes: "FA-003, Arc'teryx Granville",
      selectionCriteria: "Keeps silhouette; no visible hardware.",
      operatorComments: null,
      aiGenerationId: "gen-1",
    };
    expect(buildIdeationRound({ ...base, existingRoundNumbers: [] }).round_number).toBe(1);
    expect(buildIdeationRound({ ...base, existingRoundNumbers: [1, 2] }).round_number).toBe(3);
  });

  it("flags rounds missing prompt or ai_generations provenance", () => {
    const round = buildIdeationRound({
      garmentProjectId: "g1",
      existingRoundNumbers: [],
      promptText: "",
      referenceNotes: null,
      selectionCriteria: null,
      operatorComments: null,
      aiGenerationId: null,
    });
    const issues = ideationProvenanceIssues(round);
    expect(issues.join(" ")).toMatch(/prompt_text/);
    expect(issues.join(" ")).toMatch(/ai_generation_id/);
    expect(
      ideationProvenanceIssues({ ...round, prompt_text: "ok", ai_generation_id: "gen-1" }),
    ).toEqual([]);
  });

  it("the mock provider produces schema-valid ideation output for the registered prompt", async () => {
    const promptSeed = latestPromptFor("garment.ideation");
    expect(promptSeed).not.toBeNull();
    const provider = new MockAIProvider();
    const result = await provider.generateStructured(
      {
        feature: promptSeed!.feature,
        prompt: {
          id: null,
          feature: promptSeed!.feature,
          version: promptSeed!.version,
          systemPrompt: promptSeed!.system_prompt,
        },
        context: {
          problem_kind: "pockets",
          problem_statement: "Cropped jackets break pocket utility.",
          before_notes: "11cm pockets; phone protrudes.",
          reference_notes: "FA-003",
          selection_criteria: "Keeps silhouette.",
        },
      },
      ideationOutputSchema,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.ideas.length).toBeGreaterThan(0);
      expect(result.raw).toContain("ideas");
    }
  });
});

describe("garment case study: simulated vs physical evidence (§9.4)", () => {
  const input = {
    title: "Pocket depth on cropped jackets",
    problem_statement: "Phone protrudes from shallow pockets.",
    problem_kind: "pockets",
    before_notes: "11cm pockets.",
    tests: [
      {
        kind: "clo_simulation" as const,
        tester_label: null,
        consent_obtained: false,
        context: "CLO 3.12 drape sim.",
        feedback: "No drag at hem.",
        discrepancies_vs_simulation: null,
        tested_at: "2026-09-12T15:00:00+08:00",
      },
      {
        kind: "wear_test" as const,
        tester_label: "tester-a",
        consent_obtained: true,
        context: "Half-day SG commute.",
        feedback: "Phone secure; pocket bag warm.",
        discrepancies_vs_simulation: "Heat build-up not predicted by simulation.",
        tested_at: "2026-09-16T09:00:00+08:00",
      },
    ],
    assets: [
      { kind: "render" as const, asset_path: "a.png", version: 1, caption: "Simulated drape only.", ai_generation_id: "gen-1" },
      { kind: "fit_map" as const, asset_path: "b.png", version: 1, caption: "Simulated pressure map.", ai_generation_id: null },
      { kind: "prototype_photo" as const, asset_path: "c.jpg", version: 1, caption: "Physical prototype.", ai_generation_id: null },
      { kind: "before_photo" as const, asset_path: "d.jpg", version: 1, caption: "Before state.", ai_generation_id: null },
    ],
    measurements_before: [{ name: "pocket_depth", value: 11, unit: "cm" }],
    measurements_after: [{ name: "pocket_depth", value: 16, unit: "cm" }],
  };

  it("separates simulated and physical evidence into distinct sections", () => {
    const cs = assembleGarmentCaseStudy(input);
    expect(cs.simulated.tests.map((t) => t.kind)).toEqual(["clo_simulation"]);
    expect(cs.simulated.assets.map((a) => a.kind).sort()).toEqual(["fit_map", "render"]);
    expect(cs.physical.tests.map((t) => t.kind)).toEqual(["wear_test"]);
    expect(cs.physical.assets.map((a) => a.kind).sort()).toEqual(["before_photo", "prototype_photo"]);
    expect(cs.has_physical_evidence).toBe(true);
  });

  it("collects discrepancies between simulation and physical tests", () => {
    const cs = assembleGarmentCaseStudy(input);
    expect(cs.discrepancies).toEqual(["Heat build-up not predicted by simulation."]);
  });

  it("a simulation-only project cannot claim physical evidence", () => {
    const cs = assembleGarmentCaseStudy({ ...input, tests: [input.tests[0]] });
    expect(cs.has_physical_evidence).toBe(false);
    expect(cs.physical.tests).toEqual([]);
  });
});

describe("before/after measurement comparison (§9.4)", () => {
  it("computes deltas only when the unit matches", () => {
    const cmp = compareMeasurements(
      [
        { name: "pocket_depth", value: 11, unit: "cm" },
        { name: "hem_width", value: 52, unit: "cm" },
      ],
      [
        { name: "pocket_depth", value: 16, unit: "cm" },
        { name: "hem_width", value: 20.5, unit: "in" },
      ],
    );
    const depth = cmp.find((m) => m.name === "pocket_depth");
    expect(depth?.delta).toBe(5);
    const hem = cmp.find((m) => m.name === "hem_width");
    expect(hem?.delta).toBeNull(); // unit mismatch — never silently converted
  });

  it("reports one-sided measurements with null delta", () => {
    const cmp = compareMeasurements([{ name: "weight", value: 400, unit: "g" }], []);
    expect(cmp[0]).toEqual({ name: "weight", unit: "g", before: 400, after: null, delta: null });
  });
});
