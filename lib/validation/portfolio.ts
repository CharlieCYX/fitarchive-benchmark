import { z } from "zod";
import { ROLE_LENSES } from "@/features/portfolio/lens";
import { EVIDENCE_STAGES } from "@/features/portfolio/evidence-graph";

/** Portfolio mode (§21) form schemas. */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null));

export const portfolioSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and dashes.");

export const portfolioProjectSchema = z.object({
  slug: portfolioSlugSchema,
  title: z.string().trim().min(2, "Title is required.").max(200),
  one_line_problem: optionalText(300),
  role_lens: z.enum(ROLE_LENSES),
  contribution: optionalText(2000),
  context_constraints: optionalText(4000),
});

export const portfolioProjectEditSchema = portfolioProjectSchema.extend({
  portfolio_project_id: z.string().uuid(),
});

/** §21.2 free-text fields that live on the frozen payload. */
export const portfolioNarrativeSchema = z.object({
  portfolio_project_id: z.string().uuid(),
  evidence_summary: optionalText(8000),
  decision: optionalText(4000),
  what_changed_next: optionalText(4000),
  limitations: optionalText(4000),
});

export const portfolioEvidenceLinkSchema = z.object({
  portfolio_project_id: z.string().uuid(),
  stage: z.enum(EVIDENCE_STAGES),
  label: z.string().trim().min(2, "Label is required.").max(300),
  ref_table: optionalText(80),
  ref_id: optionalText(80),
  href: optionalText(1000),
});

export const PORTFOLIO_ARTIFACT_KINDS = ["image", "chart", "link", "metric_snapshot"] as const;

export const portfolioArtifactSchema = z.object({
  portfolio_project_id: z.string().uuid(),
  kind: z.enum(PORTFOLIO_ARTIFACT_KINDS),
  asset_path: optionalText(1000),
  url: optionalText(1000),
  metric_snapshot_id: z
    .string()
    .uuid()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  caption: optionalText(1000),
  sort_order: z.coerce.number().int().min(0).max(1000).default(0),
});

export const portfolioFreezeSchema = z.object({
  portfolio_project_id: z.string().uuid(),
  publish: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export const portfolioKoSchema = z.object({
  portfolio_project_id: z.string().uuid(),
  ko_draft: z.string().trim().max(12000).optional().or(z.literal("")),
  ko_reviewed: z
    .union([z.literal("on"), z.literal("true"), z.literal("off")])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});
