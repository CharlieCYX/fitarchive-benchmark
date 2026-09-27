import { z } from "zod";

/** Research Inbox quick-capture (§7.2). Mirrors source_listings columns. */
export const sourceListingSchema = z.object({
  source_platform_id: z.string().uuid("Pick a source platform."),
  source_url: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  seller_handle: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  title: z.string().trim().min(2, "Title is required.").max(300),
  brand: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  asking_price_sgd: z.coerce
    .number()
    .nonnegative("Price cannot be negative.")
    .max(1000000)
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)),
  condition_note: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  visible_engagement: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)),
  listing_age_days: z.coerce
    .number()
    .int()
    .nonnegative()
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)),
  notes: z
    .string()
    .trim()
    .max(4000)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  drop_candidate: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export type SourceListingInput = z.infer<typeof sourceListingSchema>;

export const researchFiltersSchema = z.object({
  platform: z.string().optional(),
  permission_state: z.string().optional(),
  drop_candidate: z.enum(["yes", "no"]).optional(),
  q: z.string().trim().max(200).optional(),
});

export type ResearchFilters = z.infer<typeof researchFiltersSchema>;

/** Promote a source listing to a draft product (§7.2 → §7.3). */
export const promoteListingSchema = z.object({
  listing_id: z.string().uuid(),
});

export const addObservationSchema = z.object({
  listing_id: z.string().uuid(),
  note: z.string().trim().min(2, "Observation note is required.").max(2000),
  confidence: z.coerce
    .number()
    .min(0, "Confidence is 0–1.")
    .max(1, "Confidence is 0–1.")
    .optional()
    .or(z.literal(NaN))
    .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : undefined)),
});
