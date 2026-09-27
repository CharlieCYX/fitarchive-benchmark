import { z } from "zod";

/** Garment Innovation Lab (§9.4) form schemas. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const GARMENT_PROBLEM_KINDS = [
  "fit",
  "pockets",
  "movement",
  "proportion",
  "modularity",
  "comfort",
  "waste",
  "upcycling",
] as const;

export const garmentProjectSchema = z.object({
  title: z.string().trim().min(2, "Project title is required.").max(200),
  problem_kind: z.enum(GARMENT_PROBLEM_KINDS),
  problem_statement: optionalText(4000),
  product_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  before_notes: optionalText(8000),
});

export const garmentProjectEditSchema = garmentProjectSchema.extend({
  garment_project_id: z.string().uuid(),
  status: z.enum(["active", "prototype_tested", "concluded", "paused"]).default("active"),
});

/** One measurement line: "pocket_depth, 11, cm, seam-to-opening". */
export const garmentMeasurementSchema = z.object({
  name: z.string().trim().min(1).max(80),
  value: z.coerce.number().finite(),
  unit: z.string().trim().min(1).max(20),
  method: z.string().trim().max(200).optional().nullable(),
});

export const garmentMeasurementsSchema = z.object({
  garment_project_id: z.string().uuid(),
  measurements_before: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal("")),
  measurements_after: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal("")),
});

export const GARMENT_ASSET_KINDS = [
  "flat",
  "clo_project",
  "render",
  "fit_map",
  "prototype_photo",
  "before_photo",
] as const;

export const garmentAssetSchema = z.object({
  garment_project_id: z.string().uuid(),
  kind: z.enum(GARMENT_ASSET_KINDS),
  asset_path: z.string().trim().min(1, "Asset path is required.").max(1000),
  version: z.coerce.number().int().positive().max(100).default(1),
  // §9.4: every render/fit-map states what the image is intended to show.
  caption: z.string().trim().min(2, "Caption required: what is this image intended to show?").max(1000),
  ai_generation_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export const GARMENT_TEST_KINDS = ["wear_test", "clo_simulation", "prototype_test"] as const;

export const garmentTestSchema = z
  .object({
    garment_project_id: z.string().uuid(),
    kind: z.enum(GARMENT_TEST_KINDS),
    tester_label: optionalText(80),
    consent_obtained: z
      .union([z.literal("on"), z.literal("true"), z.literal("off")])
      .optional()
      .transform((v) => v === "on" || v === "true"),
    context: optionalText(2000),
    feedback: optionalText(4000),
    discrepancies_vs_simulation: optionalText(4000),
    tested_at: optionalText(40),
  })
  .superRefine((val, ctx) => {
    // §15.3: a named human tester requires explicit consent.
    if (val.kind !== "clo_simulation" && val.tester_label && !val.consent_obtained) {
      ctx.addIssue({
        code: "custom",
        path: ["consent_obtained"],
        message: "Explicit consent is required when a human tester is named (§15.3).",
      });
    }
  });

export const garmentIdeationRoundSchema = z.object({
  garment_project_id: z.string().uuid(),
  prompt_text: z.string().trim().min(10, "Record the exact prompt (§9.4).").max(8000),
  reference_notes: optionalText(4000),
  selection_criteria: optionalText(2000),
  operator_comments: optionalText(4000),
});
