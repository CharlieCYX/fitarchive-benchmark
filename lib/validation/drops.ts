import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const optionalInt = z.coerce
  .number()
  .int()
  .positive()
  .max(500)
  .optional()
  .or(z.literal(NaN))
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));

export const dropSchema = z.object({
  name: z.string().trim().min(2, "Name is required.").max(120),
  concept: optionalText(2000),
  target_size_min: optionalInt,
  target_size_max: optionalInt,
});

export const dropEditSchema = z.object({
  drop_id: z.string().uuid(),
  name: z.string().trim().min(2, "Name is required.").max(120),
  concept: optionalText(2000),
  story: optionalText(8000),
  hypothesis_summary: optionalText(2000),
  target_size_min: optionalInt,
  target_size_max: optionalInt,
  launch_at: optionalText(40),
});

export const dropItemSchema = z.object({
  drop_id: z.string().uuid(),
  product_id: z.string().uuid(),
  tier: z.enum(["entry", "core", "hero"]).default("core"),
  price_override_sgd: z.coerce
    .number()
    .nonnegative()
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
});

export const dropItemUpdateSchema = z.object({
  drop_item_id: z.string().uuid(),
  drop_id: z.string().uuid(),
  tier: z.enum(["entry", "core", "hero"]).optional(),
  direction: z.enum(["up", "down"]).optional(),
  price_override_sgd: z.coerce
    .number()
    .nonnegative()
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
});

export const dropItemRemoveSchema = z.object({
  drop_item_id: z.string().uuid(),
  drop_id: z.string().uuid(),
});

export const dropHypothesisSchema = z.object({
  drop_id: z.string().uuid(),
  statement: z.string().trim().min(4, "Hypothesis statement is required.").max(1000),
  expected_outcome: optionalText(1000),
  evidence_basis: optionalText(1000),
});

/** Publish gate: manual §10.2 checks need explicit operator attestation. */
export const dropPublishSchema = z.object({
  drop_id: z.string().uuid(),
  attest_personas: z.literal("on", {
    error: "Confirm personas are documented (§10.2 check 2).",
  }),
  attest_rollback: z.literal("on", {
    error: "Confirm rollback is verified (§10.2 check 16).",
  }),
});

export const cloneDropSchema = z.object({
  drop_id: z.string().uuid(),
});
