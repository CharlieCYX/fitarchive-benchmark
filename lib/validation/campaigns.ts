import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const campaignSchema = z.object({
  name: z.string().trim().min(2, "Campaign name is required.").max(160),
  drop_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  brief: optionalText(8000),
  starts_at: optionalText(40),
  ends_at: optionalText(40),
});

export const campaignEditSchema = campaignSchema.extend({
  campaign_id: z.string().uuid(),
});

export const CAMPAIGN_CHANNELS = [
  "instagram",
  "carousell",
  "ssqrd",
  "newsletter",
  "tiktok",
  "other",
] as const;

export const campaignAssetSchema = z.object({
  campaign_id: z.string().uuid(),
  kind: z.enum(["image", "copy", "post"]),
  asset_path: optionalText(1000),
  version: z.coerce.number().int().positive().max(100).default(1),
  synthetic_disclosed: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
  provenance: z.enum(["operator", "seller", "ai_synthetic"]).default("operator"),
});

export const campaignAssetApprovalSchema = z.object({
  asset_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const campaignPostSchema = z.object({
  campaign_id: z.string().uuid(),
  channel: z.enum(CAMPAIGN_CHANNELS),
  copy: optionalText(4000),
  asset_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  planned_at: optionalText(40),
});

export const trackedLinkSchema = z.object({
  campaign_id: z.string().uuid(),
  campaign_post_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  target_url: z.string().trim().url("Target URL must be a valid URL.").max(2000),
  channel: z.enum(CAMPAIGN_CHANNELS),
  utm_source: z.string().trim().min(1, "utm_source is required.").max(120),
  utm_medium: z.string().trim().min(1, "utm_medium is required.").max(120),
  utm_content: optionalText(120),
});
