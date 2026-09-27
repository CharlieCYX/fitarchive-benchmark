"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOwnerContext,
  withMessage,
  zodMessage,
} from "@/lib/db/action-context";
import { getOrgId } from "@/lib/db/org";
import { getAIProvider, hashSystemPrompt, latestPromptFor, resolvePromptVersionId } from "@/lib/ai";
import { recordGeneration } from "@/lib/ai/generations";
import {
  garmentAssetSchema,
  garmentIdeationRoundSchema,
  garmentMeasurementsSchema,
  garmentProjectEditSchema,
  garmentProjectSchema,
  garmentTestSchema,
  garmentMeasurementSchema,
} from "@/lib/validation/garments";
import { buildIdeationRound, ideationOutputSchema } from "./ideation";
import type { Measurement } from "./case-study";

/**
 * Garment Innovation Lab actions (§9.4). AI ideation goes through the
 * Phase 7 provider gateway (lib/ai): every round records a full ai_generations
 * provenance row (§13.3) whose output stays a draft suggestion (§6.4 rule 6).
 */

function back(id: string) {
  return `/studio/garments/${id}`;
}

function parseMeasurements(raw: string | null): Measurement[] | { error: string } {
  if (!raw || !raw.trim()) return [];
  const out: Measurement[] = [];
  for (const [i, lineRaw] of raw.split("\n").entries()) {
    const line = lineRaw.trim();
    if (!line) continue;
    const [name, value, unit, method] = line.split(",").map((p) => p.trim());
    const parsed = garmentMeasurementSchema.safeParse({ name, value, unit, method: method || null });
    if (!parsed.success) {
      return { error: `Measurement line ${i + 1} ("${line.slice(0, 40)}…"): ${parsed.error.issues[0]?.message ?? "invalid"}. Format: name, value, unit[, method].` };
    }
    out.push(parsed.data);
  }
  return out;
}

export async function createGarmentProject(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/garments", "error", "No organization row found."));

  const { data, error } = await ctx.supabase
    .from("garment_projects")
    .insert({ org_id: orgId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/garments", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/garments");
  redirect(withMessage(back(data.id as string), "notice", "Garment project created — record the before-state first."));
}

export async function saveGarmentProject(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentProjectEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const { garment_project_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("garment_projects")
    .update(fields)
    .eq("id", garment_project_id);
  revalidatePath(back(garment_project_id));
  redirect(
    error
      ? withMessage(back(garment_project_id), "error", error.message)
      : withMessage(back(garment_project_id), "notice", "Project saved."),
  );
}

/** Before/after measurement sets (§9.4 comparison). One per line: name, value, unit[, method]. */
export async function saveGarmentMeasurements(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentMeasurementsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const before = parseMeasurements(parsed.data.measurements_before || null);
  if ("error" in before) {
    redirect(withMessage(back(parsed.data.garment_project_id), "error", before.error));
  }
  const after = parseMeasurements(parsed.data.measurements_after || null);
  if ("error" in after) {
    redirect(withMessage(back(parsed.data.garment_project_id), "error", after.error));
  }
  const id = parsed.data.garment_project_id;
  const { error } = await ctx.supabase
    .from("garment_projects")
    .update({ measurements_before: before, measurements_after: after })
    .eq("id", id);
  revalidatePath(back(id));
  redirect(
    error
      ? withMessage(back(id), "error", error.message)
      : withMessage(back(id), "notice", "Measurements saved."),
  );
}

/**
 * Run one AI ideation round (§9.4): exact prompt + references + selection
 * criteria are recorded, the provider gateway generates draft directions,
 * a full ai_generations provenance row is written (§13.3) and linked from
 * the round. Output is always a draft until the operator acts on it.
 */
export async function runIdeationRound(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentIdeationRoundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const input = parsed.data;
  const fail = (msg: string): never => redirect(withMessage(back(input.garment_project_id), "error", msg));

  const { data: project } = await ctx.supabase
    .from("garment_projects")
    .select("id, title, problem_kind, problem_statement, before_notes, garment_ideation_rounds(round_number)")
    .eq("id", input.garment_project_id)
    .maybeSingle();
  if (!project) fail("Garment project not found.");

  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage(back(input.garment_project_id), "error", "No organization row found."));

  const promptSeed = latestPromptFor("garment.ideation");
  if (!promptSeed) redirect(withMessage(back(input.garment_project_id), "error", "No prompt registered for garment.ideation."));

  const provider = getAIProvider();
  const prompt = {
    id: null as string | null,
    feature: promptSeed.feature,
    version: promptSeed.version,
    systemPrompt: promptSeed.system_prompt,
  };
  const proj = project as Record<string, unknown>;
  const context = {
    problem_kind: proj.problem_kind,
    problem_statement: proj.problem_statement,
    before_notes: proj.before_notes,
    reference_notes: input.reference_notes,
    selection_criteria: input.selection_criteria,
  };

  const result = await provider.generateStructured(
    { feature: promptSeed.feature, prompt, context },
    ideationOutputSchema,
  );
  const outputText = result.ok
    ? JSON.stringify(result.data)
    : await provider
        .generateText({ feature: promptSeed.feature, prompt, context })
        .then((r) => r.text)
        .catch(() => null);

  // Full provenance row (§13.3) — the round links to it.
  const promptVersionId = await resolvePromptVersionId(
    ctx.supabase,
    promptSeed.feature,
    promptSeed.version,
  );
  const recorded = await recordGeneration(ctx.supabase, {
    orgId,
    feature: promptSeed.feature,
    provider: provider.name,
    model: provider.model,
    promptVersionId,
    systemPromptHash: hashSystemPrompt(promptSeed.system_prompt),
    inputEntityRefs: { garment_project_id: input.garment_project_id, ...context },
    outputText,
    rawResponsePrivate: result.ok ? result.raw : result.error,
    createdBy: ctx.user.id,
    status: "draft", // suggestion until the operator selects (§6.4 rule 6)
    disclosureRequired: true,
    disclosureText: "AI ideation draft — hypotheses only, no physical-performance claims.",
    safetyOrTruthFlags: result.ok ? [] : ["malformed_provider_output"],
  });

  const round = buildIdeationRound({
    garmentProjectId: input.garment_project_id,
    existingRoundNumbers: ((proj.garment_ideation_rounds as Array<{ round_number: number }> | null) ?? []).map(
      (r) => r.round_number,
    ),
    promptText: input.prompt_text,
    referenceNotes: input.reference_notes,
    selectionCriteria: input.selection_criteria,
    operatorComments: input.operator_comments,
    aiGenerationId: recorded.id,
  });

  const { error } = await ctx.supabase.from("garment_ideation_rounds").insert(round);
  revalidatePath(back(input.garment_project_id));
  redirect(
    error
      ? withMessage(back(input.garment_project_id), "error", error.message)
      : withMessage(
          back(input.garment_project_id),
          "notice",
          `Ideation round ${round.round_number} recorded (provider: ${provider.name}/${provider.model}; draft — review before use).`,
        ),
  );
}

/** Add a technical flat / CLO render / fit-map / photo with intent caption (§9.4). */
export async function addGarmentAsset(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentAssetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const { garment_project_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("garment_assets").insert({
    garment_project_id,
    ...fields,
  });
  revalidatePath(back(garment_project_id));
  redirect(
    error
      ? withMessage(back(garment_project_id), "error", error.message)
      : withMessage(back(garment_project_id), "notice", "Asset recorded with intent caption."),
  );
}

/** Record a wear test / CLO simulation / prototype test (§9.4, §15.3 consent). */
export async function addGarmentTest(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/garments", "error", ctx.error));

  const parsed = garmentTestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/garments", "error", zodMessage(parsed.error)));
  }
  const { garment_project_id, tested_at, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("garment_tests").insert({
    garment_project_id,
    ...fields,
    tested_at: tested_at ? new Date(tested_at).toISOString() : null,
  });
  revalidatePath(back(garment_project_id));
  redirect(
    error
      ? withMessage(back(garment_project_id), "error", error.message)
      : withMessage(back(garment_project_id), "notice", "Test recorded. Discrepancies vs simulation belong in their own field."),
  );
}
