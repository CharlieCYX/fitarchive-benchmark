import { z } from "zod";

/**
 * Style Engine + AI gateway payload schemas (API map §23.2:
 * POST /api/style/sessions, POST /api/style/generate, POST /api/ai/generate).
 * Attribute values are taxonomy slugs; the engine never trusts free text as
 * a tag — free text lives only in notes/labels.
 */

const slug = z
  .string()
  .trim()
  .min(1)
  .max(60)
  .regex(/^[a-z0-9-]+$/, "Use lowercase tag slugs (a-z, 0-9, -).");

export const styleModeSchema = z.enum([
  "build_my_fit",
  "can_this_work",
  "decode_reference",
]);

export const climateSchema = z.enum([
  "hot-humid",
  "indoor-aircon",
  "mild",
  "cold",
]);

export const attributeSignalSchema = z.object({
  dimension: z.enum([
    "category",
    "silhouette",
    "proportion",
    "material",
    "palette_role",
    "energy",
    "era",
    "aesthetic",
    "climate",
    "use",
  ]),
  value: slug,
  confidence: z.number().min(0).max(1).nullable().default(null),
  source: z
    .enum(["human", "seller_provided", "ai_suggestion", "imported_metadata", "rule"])
    .default("human"),
});

export const garmentProfileSchema = z.object({
  id: z.string().min(1).max(120),
  source: z.enum(["catalog", "closet", "manual"]),
  label: z.string().trim().min(1).max(200),
  category: slug.nullable().default(null),
  silhouette: z.array(slug).max(6).default([]),
  material: z.array(slug).max(6).default([]),
  palette: z.array(slug).max(6).default([]),
  energy: z.array(slug).max(6).default([]),
  era: z.array(slug).max(3).default([]),
  priceSgd: z.number().nonnegative().nullable().default(null),
  availability: z.string().max(40).nullable().default(null),
});

/** POST /api/style/sessions */
export const createStyleSessionSchema = z.object({
  mode: styleModeSchema,
  inputs: z.record(z.string(), z.unknown()).default({}),
});

/** POST /api/style/generate — discriminated by mode. */
export const buildGenerateSchema = z.object({
  mode: z.literal("build_my_fit"),
  style_session_id: z.string().uuid().nullable().default(null),
  references: z.array(z.array(attributeSignalSchema).max(12)).min(1).max(5),
  occasion: z.string().trim().min(1).max(80),
  climate: climateSchema.default("hot-humid"),
  budgetSgd: z.number().positive().max(100000).nullable().default(null),
  avoidSilhouettes: z.array(slug).max(11).default([]),
  ownedItemIds: z.array(z.string().uuid()).max(50).default([]),
  useAiNarrative: z.boolean().default(true),
});

export const compatibilityGenerateSchema = z.object({
  mode: z.literal("can_this_work"),
  style_session_id: z.string().uuid().nullable().default(null),
  itemA: garmentProfileSchema,
  itemB: garmentProfileSchema,
  climate: climateSchema.default("hot-humid"),
  question: z.string().trim().max(300).default(""),
  useAiNarrative: z.boolean().default(true),
});

export const decodeGenerateSchema = z.object({
  mode: z.literal("decode_reference"),
  style_session_id: z.string().uuid().nullable().default(null),
  note: z.string().trim().max(1000).default(""),
  attributes: z.array(attributeSignalSchema).min(1).max(24),
  useAiNarrative: z.boolean().default(true),
});

export const styleGenerateSchema = z.discriminatedUnion("mode", [
  buildGenerateSchema,
  compatibilityGenerateSchema,
  decodeGenerateSchema,
]);

export type StyleGeneratePayload = z.infer<typeof styleGenerateSchema>;

/** style_feedback (§8.3 labels + §8.8 failure modes). */
export const styleFeedbackSchema = z.object({
  style_session_id: z.string().uuid(),
  label: z.enum([
    "nailed_it",
    "too_costume",
    "too_hot",
    "wrong_silhouette",
    "wrong_budget",
    "other",
  ]),
  failure_mode: z
    .enum([
      "constraint_miss",
      "hallucinated_inventory",
      "cosplay_overfit",
      "contradiction_blindness",
      "unsupported_certainty",
      "preference_miss",
    ])
    .nullable()
    .default(null),
  note: z.string().trim().max(1000).default(""),
});

/** POST /api/ai/generate — owner-only provider gateway (§13.5). */
export const aiGenerateRequestSchema = z.object({
  feature: z.string().trim().min(1).max(120),
  mode: z.enum(["text", "structured"]).default("text"),
  context: z.record(z.string(), z.unknown()).default({}),
  input_entity_refs: z.record(z.string(), z.unknown()).default({}),
  disclosure_required: z.boolean().default(false),
});

/* ------------------------- Archive (§8.2) payloads ------------------------ */

export const closetItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: slug.nullable().default(null),
  color: z.string().trim().max(60).default(""),
  fit_notes: z.string().trim().max(500).default(""),
  wear_frequency: z
    .enum(["daily", "weekly", "monthly", "rarely"])
    .nullable()
    .default(null),
  ownership_source: z
    .enum(["owned", "borrowed", "borrowed_for_content", "on_loan"])
    .default("owned"),
});

export const collectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});

export const styleReferenceSchema = z.object({
  source: z.enum(["upload", "url"]),
  url: z.union([z.literal(""), z.string().url().max(2000)]).default(""),
  note: z.string().trim().max(1000).default(""),
  /** Newline/comma-separated "dimension:value" pairs, e.g. "silhouette:boxy". */
  attributes: z
    .array(
      z.object({
        dimension: attributeSignalSchema.shape.dimension,
        value: slug,
      }),
    )
    .max(12)
    .default([]),
});
