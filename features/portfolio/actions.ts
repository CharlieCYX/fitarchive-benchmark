"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOwnerContext,
  withMessage,
  zodMessage,
} from "@/lib/db/action-context";
import { getOrgId } from "@/lib/db/org";
import { getAIProvider, hashSystemPrompt, latestPromptFor, resolvePromptVersionId } from "@/lib/ai";
import { recordGeneration } from "@/lib/ai/generations";
import {
  portfolioArtifactSchema,
  portfolioEvidenceLinkSchema,
  portfolioFreezeSchema,
  portfolioKoSchema,
  portfolioNarrativeSchema,
  portfolioProjectEditSchema,
  portfolioProjectSchema,
} from "@/lib/validation/portfolio";
import { validateEvidenceLink } from "./evidence-graph";
import type { EvidenceLink } from "./snapshot";
import { freezePortfolioSnapshot } from "./freeze";

/**
 * Portfolio builder actions (§21). Freezing goes through
 * freezePortfolioSnapshot — the same code path as POST /api/portfolio/snapshot.
 */

function back(id: string) {
  return `/studio/portfolio/${id}`;
}

export async function createPortfolioProject(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/portfolio", "error", "No organization row found."));

  const { data, error } = await ctx.supabase
    .from("portfolio_projects")
    .insert({ org_id: orgId, ...parsed.data })
    .select("id")
    .single();
  if (error || !data) {
    redirect(withMessage("/studio/portfolio", "error", error?.message ?? "Create failed."));
  }
  revalidatePath("/studio/portfolio");
  redirect(withMessage(back(data.id as string), "notice", "Portfolio project created — link real evidence next."));
}

export async function savePortfolioProject(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioProjectEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const { portfolio_project_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update(fields)
    .eq("id", portfolio_project_id);
  revalidatePath(back(portfolio_project_id));
  redirect(
    error
      ? withMessage(back(portfolio_project_id), "error", error.message)
      : withMessage(back(portfolio_project_id), "notice", "Project saved."),
  );
}

/** §21.2 narrative fields (evidence summary, decision, what changed next, limitations). */
export async function savePortfolioNarrative(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioNarrativeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const { portfolio_project_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update(fields)
    .eq("id", portfolio_project_id);
  revalidatePath(back(portfolio_project_id));
  redirect(
    error
      ? withMessage(back(portfolio_project_id), "error", error.message)
      : withMessage(back(portfolio_project_id), "notice", "Narrative saved."),
  );
}

/** Add one evidence-graph link (§21.1) — real records only, in stage order. */
export async function addEvidenceLink(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioEvidenceLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const { portfolio_project_id, ...fields } = parsed.data;

  const link: EvidenceLink = {
    stage: fields.stage,
    label: fields.label,
    ref_table: fields.ref_table,
    ref_id: fields.ref_id,
    href: fields.href,
  };
  const invalid = validateEvidenceLink(link);
  if (invalid) redirect(withMessage(back(portfolio_project_id), "error", invalid));

  const { data: project } = await ctx.supabase
    .from("portfolio_projects")
    .select("evidence_links")
    .eq("id", portfolio_project_id)
    .maybeSingle();
  if (!project) redirect(withMessage(back(portfolio_project_id), "error", "Project not found."));

  const links = [
    ...(((project as Record<string, unknown>).evidence_links as unknown[] | null) ?? []),
    link,
  ];
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update({ evidence_links: links })
    .eq("id", portfolio_project_id);
  revalidatePath(back(portfolio_project_id));
  redirect(
    error
      ? withMessage(back(portfolio_project_id), "error", error.message)
      : withMessage(back(portfolio_project_id), "notice", `Evidence link added (${link.stage}).`),
  );
}

/** Remove one evidence link by index (operator correction; snapshots already frozen are unaffected). */
export async function removeEvidenceLink(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const projectId = String(formData.get("portfolio_project_id") ?? "");
  const index = Number(formData.get("index") ?? -1);
  const { data: project } = await ctx.supabase
    .from("portfolio_projects")
    .select("evidence_links")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) redirect(withMessage(back(projectId), "error", "Project not found."));

  const links = ([...(((project as Record<string, unknown>).evidence_links as unknown[] | null) ?? [])]);
  if (index < 0 || index >= links.length) {
    redirect(withMessage(back(projectId), "error", "Evidence link index out of range."));
  }
  links.splice(index, 1);
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update({ evidence_links: links })
    .eq("id", projectId);
  revalidatePath(back(projectId));
  redirect(
    error
      ? withMessage(back(projectId), "error", error.message)
      : withMessage(back(projectId), "notice", "Evidence link removed."),
  );
}

/** Add an execution artifact (image / chart / link / metric_snapshot). */
export async function addPortfolioArtifact(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioArtifactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const { portfolio_project_id, ...fields } = parsed.data;
  const { error } = await ctx.supabase.from("portfolio_artifacts").insert({
    portfolio_project_id,
    ...fields,
  });
  revalidatePath(back(portfolio_project_id));
  redirect(
    error
      ? withMessage(back(portfolio_project_id), "error", error.message)
      : withMessage(back(portfolio_project_id), "notice", "Artifact added."),
  );
}

/**
 * Freeze a snapshot (§21.2, §6.4 rule 8). Append-only: every freeze creates
 * a new version with a new slug; previously frozen snapshots are untouched.
 */
export async function freezeSnapshot(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioFreezeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const result = await freezePortfolioSnapshot(ctx.supabase, parsed.data.portfolio_project_id, {
    publish: parsed.data.publish,
    actorId: ctx.user.id,
  });
  revalidatePath(back(parsed.data.portfolio_project_id));
  redirect(
    result.ok
      ? withMessage(
          back(parsed.data.portfolio_project_id),
          "notice",
          `Snapshot v${result.version} frozen at /portfolio/${result.slug}${parsed.data.publish ? " (public)" : " (private)"}. Later edits will NOT rewrite it.`,
        )
      : withMessage(back(parsed.data.portfolio_project_id), "error", result.error ?? "Freeze failed."),
  );
}

/** Toggle public visibility on a snapshot (payload/version stay frozen). */
export async function setSnapshotVisibility(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const projectId = String(formData.get("portfolio_project_id") ?? "");
  const snapshotId = String(formData.get("snapshot_id") ?? "");
  const makePublic = String(formData.get("is_public") ?? "") === "true";
  const { error } = await ctx.supabase
    .from("portfolio_snapshots")
    .update({
      is_public: makePublic,
      published_at: makePublic ? new Date().toISOString() : null,
    })
    .eq("id", snapshotId);
  revalidatePath(back(projectId));
  redirect(
    error
      ? withMessage(back(projectId), "error", error.message)
      : withMessage(back(projectId), "notice", makePublic ? "Snapshot published." : "Snapshot unpublished."),
  );
}

/**
 * Korean translation draft via the provider gateway (§21.2, §13.4): the
 * draft is machine-assisted until the operator marks it reviewed.
 */
export async function generateKoDraft(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const projectId = String(formData.get("portfolio_project_id") ?? "");
  const { data: project } = await ctx.supabase
    .from("portfolio_projects")
    .select("title, one_line_problem, evidence_summary, decision, what_changed_next, limitations")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) redirect(withMessage(back(projectId), "error", "Project not found."));

  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage(back(projectId), "error", "No organization row found."));

  const promptSeed = latestPromptFor("portfolio.ko_translation");
  if (!promptSeed) redirect(withMessage(back(projectId), "error", "No prompt registered for portfolio.ko_translation."));

  const provider = getAIProvider();
  const p = project as Record<string, unknown>;
  const sourceText = [
    p.one_line_problem,
    p.evidence_summary,
    p.decision,
    p.what_changed_next,
    p.limitations,
  ]
    .filter((v): v is string => typeof v === "string" && Boolean(v))
    .join("\n");

  const result = await provider.generateText({
    feature: promptSeed.feature,
    prompt: {
      id: null,
      feature: promptSeed.feature,
      version: promptSeed.version,
      systemPrompt: promptSeed.system_prompt,
    },
    context: { title: p.title, text: sourceText },
  });

  const promptVersionId = await resolvePromptVersionId(
    ctx.supabase,
    promptSeed.feature,
    promptSeed.version,
  );
  await recordGeneration(ctx.supabase, {
    orgId,
    feature: promptSeed.feature,
    provider: provider.name,
    model: provider.model,
    promptVersionId,
    systemPromptHash: hashSystemPrompt(promptSeed.system_prompt),
    inputEntityRefs: { portfolio_project_id: projectId },
    outputText: result.text,
    rawResponsePrivate: result.text,
    createdBy: ctx.user.id,
    status: "draft",
    disclosureRequired: true,
    disclosureText: "Korean translation draft — machine-assisted, requires human review (§13.4).",
  });

  // Machine-assisted: ko_reviewed resets to false whenever a new draft lands.
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update({ ko_draft: result.text, ko_reviewed: false })
    .eq("id", projectId);
  revalidatePath(back(projectId));
  redirect(
    error
      ? withMessage(back(projectId), "error", error.message)
      : withMessage(back(projectId), "notice", "KO draft generated — flagged machine-assisted until reviewed."),
  );
}

/** Save/approve the KO draft. Approving sets ko_reviewed=true (§13.4). */
export async function saveKoDraft(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/portfolio", "error", ctx.error));

  const parsed = portfolioKoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/portfolio", "error", zodMessage(parsed.error)));
  }
  const { portfolio_project_id, ko_draft, ko_reviewed } = parsed.data;
  const { error } = await ctx.supabase
    .from("portfolio_projects")
    .update({ ko_draft: ko_draft || null, ko_reviewed: ko_reviewed && Boolean(ko_draft) })
    .eq("id", portfolio_project_id);
  revalidatePath(back(portfolio_project_id));
  redirect(
    error
      ? withMessage(back(portfolio_project_id), "error", error.message)
      : withMessage(
          back(portfolio_project_id),
          "notice",
          ko_reviewed ? "KO draft marked human-reviewed." : "KO draft saved as machine-assisted.",
        ),
  );
}
