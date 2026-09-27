import { z } from "zod";

export const CONDITION_GRADES = [
  "new_unworn",
  "excellent",
  "good",
  "fair",
  "project_repair",
] as const;

export const AVAILABILITY_STATUSES = [
  "draft",
  "available",
  "reserved",
  "sold",
  "withdrawn",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

const optionalMoney = z.coerce
  .number()
  .nonnegative("Amount cannot be negative.")
  .max(1000000)
  .optional()
  .or(z.literal(NaN))
  .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null));

/** Product identity + merchandising edit (§7.3). */
export const productEditSchema = z.object({
  product_id: z.string().uuid(),
  title: z.string().trim().min(2, "Title is required.").max(300),
  brand: optionalText(120),
  category_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  condition_grade: z.enum(CONDITION_GRADES).optional().or(z.literal("")).transform((v) => (v ? v : null)),
  defect_notes: optionalText(4000),
  description_public: optionalText(4000),
  notes_private: optionalText(4000),
  public_price_sgd: optionalMoney,
  cost_basis_sgd: optionalMoney,
});

export type ProductEditInput = z.infer<typeof productEditSchema>;

/** Availability state machine transition (§7.3, ARCHITECTURE §7). */
export const availabilityTransitionSchema = z.object({
  product_id: z.string().uuid(),
  to: z.enum(AVAILABILITY_STATUSES),
});

export const measurementSchema = z.object({
  product_id: z.string().uuid(),
  name: z.string().trim().min(1, "Measurement name is required.").max(60),
  value: z.coerce.number().positive("Value must be positive.").max(10000),
  unit: z.string().trim().min(1).max(12).default("cm"),
  method: optionalText(300),
});

export const deleteMeasurementSchema = z.object({
  measurement_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

export const ownershipRecordSchema = z.object({
  product_id: z.string().uuid(),
  state: z.enum([
    "observed_only",
    "contacted",
    "permission_referral",
    "permission_consignment",
    "owned",
    "borrowed_for_content",
    "prototype_permission",
    "expired_revoked",
  ]),
  note: optionalText(1000),
});

export const productAssetSchema = z.object({
  product_id: z.string().uuid(),
  path: z.string().trim().min(1, "Asset path is required.").max(1000),
  bucket: z.enum(["public-assets", "private-assets"]).default("private-assets"),
  alt_text: optionalText(300),
  provenance: z.enum(["operator", "seller", "ai_synthetic"]).default("operator"),
  synthetic: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  rights_note: optionalText(1000),
  privacy: z.enum(["public", "private"]).default("private"),
});

export const catalogFiltersSchema = z.object({
  availability: z.enum(AVAILABILITY_STATUSES).optional(),
  missing: z.enum(["data", "imagery"]).optional(),
  q: z.string().trim().max(200).optional(),
});

export type CatalogFilters = z.infer<typeof catalogFiltersSchema>;
