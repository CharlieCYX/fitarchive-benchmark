import { z } from "zod";

export const PERMISSION_STATES = [
  "observed_only",
  "contacted",
  "permission_referral",
  "permission_consignment",
  "owned",
  "borrowed_for_content",
  "prototype_permission",
  "expired_revoked",
] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const sellerSchema = z.object({
  handle: z
    .string()
    .trim()
    .min(2, "Handle is required.")
    .max(60)
    .regex(/^@?[a-z0-9_.-]+$/i, "Handle: letters, numbers, _ . - only."),
  display_name: z.string().trim().min(2, "Display name is required.").max(120),
  notes_private: optionalText(2000),
});

export const sellerContactSchema = z.object({
  seller_id: z.string().uuid(),
  channel: z.enum(["carousell", "ig", "email", "phone", "other"]),
  value: z.string().trim().min(1, "Contact value is required.").max(300),
  is_preferred: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const permissionRequestSchema = z.object({
  seller_id: z.string().uuid(),
  product_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  scope: z.enum(["representation", "media", "alteration"]),
  state: z.enum(PERMISSION_STATES),
  granted_at: optionalText(40),
  expires_at: optionalText(40),
});

export const permissionTransitionSchema = z.object({
  permission_id: z.string().uuid(),
  seller_id: z.string().uuid(),
  to: z.enum(PERMISSION_STATES),
});

export const agreementSchema = z
  .object({
    seller_id: z.string().uuid(),
    type: z.enum(["owned", "consignment", "referral", "content_collaboration"]),
    seller_share_pct: z.coerce
      .number()
      .min(0)
      .max(100)
      .optional()
      .or(z.literal(NaN))
      .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
    seller_fixed_amount_sgd: z.coerce
      .number()
      .nonnegative()
      .optional()
      .or(z.literal(NaN))
      .transform((v) => (typeof v === "number" && Number.isFinite(v) ? v : null)),
    fulfillment_responsibility: optionalText(300),
    payout_reference: optionalText(120),
    return_terms: optionalText(1000),
    ends_at: optionalText(40),
  })
  .refine(
    (a) =>
      a.seller_share_pct !== null ||
      a.seller_fixed_amount_sgd !== null ||
      a.type === "owned" ||
      a.type === "content_collaboration",
    {
      message:
        "Consignment/referral agreements need a seller share % or fixed amount (DATA_MODEL check agreements_terms_present).",
      path: ["seller_share_pct"],
    },
  );
