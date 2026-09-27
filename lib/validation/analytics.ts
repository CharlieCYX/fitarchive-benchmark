import { z } from "zod";
import { METRIC_KEYS } from "@/lib/metrics";
import {
  CONCLUSION_STRENGTHS,
  EVIDENCE_STATES,
  EXPERIMENT_STATUSES,
  EXPERIMENT_UNITS,
} from "@/features/analytics/evidence";

/**
 * Analytics validation schemas (§9.1/§9.2/§12.4). Note `forecast` is NOT in
 * the insight-type enum here — it is disabled product-wide (§9.2) even though
 * the DB enum includes it.
 */

const emptyToNull = (v: unknown) =>
  v === undefined || (typeof v === "string" && v.trim() === "") ? null : v;

export const insightSchema = z.object({
  type: z.enum(EVIDENCE_STATES, {
    error: "Pick an evidence state (forecast is disabled — see §9.2).",
  }),
  title: z.string().trim().min(3, "Title needs at least 3 characters.").max(200),
  body: z.preprocess(emptyToNull, z.string().trim().max(4000).nullable()),
  confidence: z.preprocess(
    emptyToNull,
    z.coerce
      .number()
      .min(0, "Confidence is 0–1.")
      .max(1, "Confidence is 0–1.")
      .nullable(),
  ),
  sample_size: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).nullable(),
  ),
  affected_drop_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  owner_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

export type InsightInput = z.infer<typeof insightSchema>;

export const decisionCardSchema = z.object({
  chart_ref: z.string().trim().min(1).max(200),
  decision: z.string().trim().min(5, "Write the decision (min 5 characters).").max(500),
  confidence: z.preprocess(
    emptyToNull,
    z.coerce.number().min(0).max(1).nullable(),
  ),
  owner_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
  affected_drop_id: z.preprocess(emptyToNull, z.string().uuid().nullable()),
});

export const experimentSchema = z.object({
  name: z.string().trim().min(3).max(200),
  hypothesis: z.string().trim().min(10, "State a testable hypothesis.").max(4000),
  primary_metric: z.enum(METRIC_KEYS, {
    error: "Primary metric must be a canonical metric key.",
  }),
  guardrail_metrics: z.preprocess(
    (v) =>
      typeof v === "string"
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : v,
    z.array(z.enum(METRIC_KEYS)).max(5).default([]),
  ),
  unit_of_assignment: z.enum(EXPERIMENT_UNITS),
  variant_a_label: z.string().trim().min(1, "Variant A needs a label.").max(120),
  variant_a_notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
  variant_b_label: z.string().trim().min(1, "Variant B needs a label.").max(120),
  variant_b_notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
  start_at: z.preprocess(emptyToNull, z.string().nullable()),
  end_at: z.preprocess(emptyToNull, z.string().nullable()),
  sample_target_or_rationale: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000).nullable(),
  ),
  confounders_notes: z.preprocess(emptyToNull, z.string().trim().max(1000).nullable()),
});

export type ExperimentInput = z.infer<typeof experimentSchema>;

export const experimentStatusSchema = z.object({
  experiment_id: z.string().uuid(),
  to_status: z.enum(EXPERIMENT_STATUSES),
});

export const concludeExperimentSchema = z.object({
  experiment_id: z.string().uuid(),
  conclusion: z.string().trim().min(10, "Conclusion needs at least 10 characters.").max(4000),
  conclusion_strength: z.enum(CONCLUSION_STRENGTHS),
});
