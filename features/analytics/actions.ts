"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOwnerContext,
  withMessage,
  zodMessage,
} from "@/lib/db/action-context";
import { getOrgId } from "@/lib/db/org";
import {
  concludeExperimentSchema,
  decisionCardSchema,
  experimentSchema,
  experimentStatusSchema,
  insightSchema,
} from "@/lib/validation/analytics";
import {
  createInsight,
  deleteInsight,
  updateInsight,
} from "./insights";
import {
  concludeExperiment,
  createExperiment,
  transitionExperiment,
} from "./experiments";
import { buildSnapshotRows } from "./metric-service";

/** Insight CRUD (§9.2). `forecast` never validates — see lib/validation/analytics. */
export async function createInsightAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/insights", "error", ctx.error));

  const parsed = insightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/insights", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/insights", "error", "No organization row found."));

  const result = await createInsight(ctx.supabase, orgId, parsed.data, ctx.user.id);
  revalidatePath("/studio/insights");
  redirect(
    result.ok
      ? withMessage("/studio/insights", "notice", "Insight recorded.")
      : withMessage("/studio/insights", "error", result.error ?? "Save failed."),
  );
}

export async function updateInsightAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/insights", "error", ctx.error));

  const id = String(formData.get("id") ?? "");
  const parsed = insightSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/insights", "error", zodMessage(parsed.error)));
  }
  const result = await updateInsight(ctx.supabase, id, parsed.data);
  revalidatePath("/studio/insights");
  redirect(
    result.ok
      ? withMessage("/studio/insights", "notice", "Insight updated.")
      : withMessage("/studio/insights", "error", result.error ?? "Update failed."),
  );
}

export async function deleteInsightAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/insights", "error", ctx.error));
  const id = String(formData.get("id") ?? "");
  const result = await deleteInsight(ctx.supabase, id);
  revalidatePath("/studio/insights");
  redirect(
    result.ok
      ? withMessage("/studio/insights", "notice", "Insight deleted.")
      : withMessage("/studio/insights", "error", result.error ?? "Delete failed."),
  );
}

/**
 * Decision card (§9.1): a written decision + owner + date + confidence,
 * attached to a chart. Stored as an insight whose body carries the chart ref.
 */
export async function attachDecisionCard(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/analytics", "error", ctx.error));

  const parsed = decisionCardSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/analytics", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/analytics", "error", "No organization row found."));

  const d = parsed.data;
  const result = await createInsight(
    ctx.supabase,
    orgId,
    {
      type: "observation",
      title: `Decision — ${d.chart_ref}`,
      body: d.decision,
      confidence: d.confidence,
      owner_id: d.owner_id,
      sample_size: null,
      affected_drop_id: d.affected_drop_id,
    },
    ctx.user.id,
  );
  revalidatePath("/studio/analytics");
  redirect(
    result.ok
      ? withMessage("/studio/analytics", "notice", `Decision card attached to “${d.chart_ref}”.`)
      : withMessage("/studio/analytics", "error", result.error ?? "Save failed."),
  );
}

/**
 * Dashboard version snapshot (§9.1): freeze current canonical metric values
 * into metric_snapshots so portfolio artifacts can pin them later.
 */
export async function captureDashboardSnapshot(): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/analytics", "error", ctx.error));
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/analytics", "error", "No organization row found."));

  const rows = await buildSnapshotRows(ctx.supabase, orgId);
  const withValues = rows.filter((r) => r.value !== null);
  if (withValues.length === 0) {
    redirect(
      withMessage(
        "/studio/analytics",
        "error",
        "Nothing to snapshot — no canonical metric has data yet.",
      ),
    );
  }
  const capturedAt = new Date().toISOString();
  const { error } = await ctx.supabase.from("metric_snapshots").insert(
    withValues.map((r) => ({
      metric_key: r.metricKey,
      scope: r.scope,
      value: r.value,
      sample_size: r.sampleSize,
      captured_at: capturedAt,
    })),
  );
  revalidatePath("/studio/analytics");
  redirect(
    error
      ? withMessage("/studio/analytics", "error", error.message)
      : withMessage(
          "/studio/analytics",
          "notice",
          `Snapshot captured: ${withValues.length} metric values frozen at ${capturedAt.slice(0, 16)} UTC.`,
        ),
  );
}

// ---------- experiments (§12.4) ----------

export async function createExperimentAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/experiments", "error", ctx.error));

  const parsed = experimentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/experiments", "error", zodMessage(parsed.error)));
  }
  const orgId = await getOrgId(ctx.supabase);
  if (!orgId) redirect(withMessage("/studio/experiments", "error", "No organization row found."));

  const result = await createExperiment(ctx.supabase, orgId, parsed.data);
  if (!result.ok) {
    redirect(withMessage("/studio/experiments", "error", result.error ?? "Save failed."));
  }
  revalidatePath("/studio/experiments");
  redirect(
    withMessage(
      `/studio/experiments/${result.id}`,
      "notice",
      "Experiment drafted. Move it to running when both variants are live.",
    ),
  );
}

export async function transitionExperimentAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/experiments", "error", ctx.error));

  const parsed = experimentStatusSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/experiments", "error", zodMessage(parsed.error)));
  }
  const { experiment_id, to_status } = parsed.data;
  const back = `/studio/experiments/${experiment_id}`;
  const result = await transitionExperiment(ctx.supabase, experiment_id, to_status);
  revalidatePath(back);
  redirect(
    result.ok
      ? withMessage(back, "notice", `Status → ${to_status}.`)
      : withMessage(back, "error", result.error ?? "Transition failed."),
  );
}

export async function concludeExperimentAction(formData: FormData): Promise<void> {
  const ctx = await requireOwnerContext();
  if (!ctx.ok) redirect(withMessage("/studio/experiments", "error", ctx.error));

  const parsed = concludeExperimentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(withMessage("/studio/experiments", "error", zodMessage(parsed.error)));
  }
  const { experiment_id, conclusion, conclusion_strength } = parsed.data;
  const back = `/studio/experiments/${experiment_id}`;
  const result = await concludeExperiment(
    ctx.supabase,
    experiment_id,
    conclusion,
    conclusion_strength,
  );
  revalidatePath(back);
  revalidatePath("/studio/experiments");
  redirect(
    result.ok
      ? withMessage(back, "notice", "Experiment concluded.")
      : withMessage(back, "error", result.error ?? "Conclude failed."),
  );
}
