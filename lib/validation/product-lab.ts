import { z } from "zod";

/** Product Lab / PRD Studio (§9.5) form schemas. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const productBriefSchema = z.object({
  title: z.string().trim().min(2, "Brief title is required.").max(200),
  problem: optionalText(4000),
  evidence: optionalText(4000),
  current_workaround: optionalText(4000),
  target_outcome: optionalText(4000),
});

export const productBriefEditSchema = productBriefSchema.extend({
  product_brief_id: z.string().uuid(),
  status: z
    .enum(["draft", "prd_written", "prv_prototyped", "shipped", "postmortem_done", "rejected"])
    .default("draft"),
});

/**
 * jsonb textareas: the operator pastes JSON; we parse defensively and keep
 * the raw value out when invalid (the action reports the parse error).
 */
const jsonText = (label: string) =>
  z
    .string()
    .trim()
    .max(20000)
    .optional()
    .or(z.literal(""))
    .transform((v, ctx) => {
      if (!v) return null;
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: `${label} must be valid JSON.` });
        return z.NEVER;
      }
    });

export const prdSchema = z.object({
  product_brief_id: z.string().uuid(),
  competitor_matrix: jsonText("Competitor matrix"),
  user_stories: jsonText("User stories"),
  functional_requirements: jsonText("Functional requirements"),
  nonfunctional_requirements: jsonText("Non-functional requirements"),
  mvp_scope: optionalText(8000),
  // §9.5: the deliberately-deferred list is part of the MVP boundary.
  deferred_features: optionalText(8000),
  success_metrics: jsonText("Success metrics"),
  instrumentation_plan: optionalText(8000),
});

export const prdEditSchema = prdSchema.extend({
  prd_id: z.string().uuid(),
});

export const prototypeTestSchema = z.object({
  prd_id: z.string().uuid(),
  product_brief_id: z.string().uuid(),
  prototype_url: optionalText(1000),
  tester_label: optionalText(80),
  observation: z.string().trim().min(2, "Observation is required.").max(4000),
  confusion_notes: optionalText(4000),
  tested_at: optionalText(40),
});

/** One release in the feature build record (§9.5). */
export const releaseSchema = z.object({
  prd_id: z.string().uuid(),
  product_brief_id: z.string().uuid(),
  version: z.string().trim().min(1).max(40),
  released_at: optionalText(40),
  summary: z.string().trim().min(2, "Release summary is required.").max(2000),
  feedback: optionalText(4000),
});

/** Postmortem incl. the explicit "what should not be built" (§9.5). */
export const postmortemSchema = z.object({
  prd_id: z.string().uuid(),
  product_brief_id: z.string().uuid(),
  postmortem: z.string().trim().min(10, "Postmortem is required.").max(12000),
});
