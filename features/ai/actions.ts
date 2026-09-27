"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOwnerContext, withMessage } from "@/lib/db/action-context";
import { getOrgId } from "@/lib/db/org";
import { getAIProvider, hashSystemPrompt, latestPromptFor } from "@/lib/ai";
import { recordGeneration } from "@/lib/ai/generations";
import { styleNarrativeSchema } from "@/features/style-engine/narrative";
import { EVAL_CASES, type FailureMode } from "./eval-cases";
import { runAllEvalCases, type EvalRunResult } from "./harness";
import { RATING_DIMENSIONS, type RatingDimension } from "./ratings";

/**
 * AI Lab actions (§13.5): run the §8.8 evaluation harness against the active
 * provider, and record human ratings with failure-mode tags on generations.
 */

export interface EvalHarnessOutcome {
  ok: boolean;
  error?: string;
  results?: EvalRunResult[];
  providerContract?: { ok: boolean; detail: string };
  generationId?: string | null;
  provider?: string;
}

/**
 * Run all §8.8 cases against the deterministic engine + a structured-output
 * contract probe against the active provider. Records an ai_generations row
 * (feature "ai_lab.eval") so harness runs appear in the provenance browser.
 */
export async function runEvalHarness(): Promise<EvalHarnessOutcome> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  const results = runAllEvalCases(EVAL_CASES);

  // Provider contract probe: the active provider must return schema-valid
  // structured output for a canonical build_my_fit context (§16 AI contract).
  const provider = getAIProvider();
  const promptSeed = latestPromptFor("style_engine.build_my_fit");
  let contract: { ok: boolean; detail: string } = {
    ok: false,
    detail: "No prompt registered for style_engine.build_my_fit.",
  };
  if (promptSeed) {
    const probe = await provider.generateStructured(
      {
        feature: promptSeed.feature,
        prompt: {
          id: null,
          feature: promptSeed.feature,
          version: promptSeed.version,
          systemPrompt: promptSeed.system_prompt,
        },
        context: {
          thesisLines: ["Probe: boxy shapes, monochrome palette."],
          sharedSignals: ["silhouette:boxy"],
          contradictions: [],
          climateNotes: [],
          occasion: "daily",
          climate: "hot-humid",
        },
      },
      styleNarrativeSchema,
    );
    contract = probe.ok
      ? { ok: true, detail: `Structured output validated against the narrative schema (${probe.provider}/${probe.model}).` }
      : { ok: false, detail: `Provider contract FAILED: ${probe.error}` };
  }

  const failing = results.filter((r) => !r.pass);
  const summary = {
    cases: results.length,
    passed: results.length - failing.length,
    failures: failing.map((f) => ({ case: f.caseId, violations: f.violations })),
    provider_contract: contract,
  };

  // Provenance: the harness run itself is a generation (§13.3).
  let generationId: string | null = null;
  const orgId = await getOrgId(ctx.supabase);
  if (orgId) {
    const recorded = await recordGeneration(ctx.supabase, {
      orgId,
      feature: "ai_lab.eval",
      provider: provider.name,
      model: provider.model,
      promptVersionId: null,
      systemPromptHash: promptSeed ? hashSystemPrompt(promptSeed.system_prompt) : "sha256:none",
      inputEntityRefs: { eval_cases: EVAL_CASES.map((c) => c.id) },
      outputText: JSON.stringify(summary),
      rawResponsePrivate: JSON.stringify({ results, contract }),
      createdBy: ctx.user.id,
      status: failing.length || !contract.ok ? "rejected" : "draft",
      safetyOrTruthFlags: failing.map((f) => `case_failed:${f.caseId}`),
    });
    generationId = recorded.id;
  }

  revalidatePath("/studio/ai-lab");
  return {
    ok: true,
    results,
    providerContract: contract,
    generationId,
    provider: `${provider.name}/${provider.model}`,
  };
}

/** Quick accept/reject from the provenance browser (§13.4). */
export async function setGenerationStatus(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/ai-lab", "error", ctx.error));

  const id = String(formData.get("generation_id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!["accepted", "rejected", "superseded"].includes(status)) {
    redirect(withMessage("/studio/ai-lab", "error", "Unknown status."));
  }
  const { error } = await ctx.supabase
    .from("ai_generations")
    .update({ status })
    .eq("id", id);
  revalidatePath("/studio/ai-lab");
  redirect(
    error
      ? withMessage("/studio/ai-lab", "error", error.message)
      : withMessage("/studio/ai-lab", "notice", `Generation marked ${status}.`),
  );
}

export interface RateGenerationInput {
  generationId: string;
  ratings: Record<RatingDimension, number>; // 1–5 each
  failureModes: FailureMode[];
  notes: string;
  decision: "accepted" | "rejected";
}

/**
 * Human review with §13.5 rating dimensions + §8.8 failure-mode tags.
 * Ratings are stored on the generation (human_editor_notes JSON) so the
 * provenance trail stays in one place.
 */
export async function rateGeneration(
  input: RateGenerationInput,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) return { ok: false, error: ctx.error };

  for (const dimension of RATING_DIMENSIONS) {
    const value = input.ratings[dimension];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      return { ok: false, error: `Rating for ${dimension} must be 1–5.` };
    }
  }

  const review = {
    ratings: input.ratings,
    failure_modes: input.failureModes,
    notes: input.notes.slice(0, 1000),
    reviewed_at: new Date().toISOString(),
    reviewer: ctx.user.email ?? ctx.user.id,
  };

  const { error } = await ctx.supabase
    .from("ai_generations")
    .update({
      status: input.decision,
      human_editor_notes: JSON.stringify(review),
      safety_or_truth_flags: input.failureModes,
    })
    .eq("id", input.generationId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/studio/ai-lab");
  return { ok: true };
}
