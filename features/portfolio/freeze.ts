import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_LENS_EMPHASIS, isRoleLens } from "./lens";
import {
  assertNoPrivateFields,
  buildFrozenPayload,
  nextSnapshotVersion,
  snapshotSlug,
  type EvidenceLink,
  type PublicArtifact,
  type ResultMetric,
} from "./snapshot";

/**
 * Snapshot freeze (§21.2, ADR-006) — server-only.
 *
 * Assembles the frozen payload from the project + artifacts + referenced
 * metric snapshots, strips to the §21.2 allowlist, runs the §15.2
 * private-field guard, and inserts a NEW append-only snapshot row. Source
 * edits after the freeze never mutate it (DB trigger enforces).
 */

export interface FreezeResult {
  ok: boolean;
  error?: string;
  snapshotId?: string;
  slug?: string;
  version?: number;
}

export async function freezePortfolioSnapshot(
  supabase: SupabaseClient,
  portfolioProjectId: string,
  opts: { publish: boolean; actorId: string | null },
): Promise<FreezeResult> {
  const { data: project } = await supabase
    .from("portfolio_projects")
    .select(
      "id, slug, title, one_line_problem, role_lens, contribution, context_constraints, evidence_links, evidence_summary, decision, what_changed_next, limitations, ko_draft, ko_reviewed",
    )
    .eq("id", portfolioProjectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Portfolio project not found." };
  const p = project as Record<string, unknown>;

  const roleLens = p.role_lens as string | null;
  if (!roleLens || !isRoleLens(roleLens)) {
    return { ok: false, error: "Set a role lens (§21) before freezing a snapshot." };
  }

  const [{ data: artifacts }, { data: existingSnapshots }] = await Promise.all([
    supabase
      .from("portfolio_artifacts")
      .select("id, kind, asset_path, url, metric_snapshot_id, caption, sort_order")
      .eq("portfolio_project_id", portfolioProjectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_snapshots")
      .select("version")
      .eq("portfolio_project_id", portfolioProjectId),
  ]);

  // Resolve metric_snapshot artifacts into result metrics with period/sample
  // (§21.2: "result metrics with period/sample"). Only public metric fields
  // are copied — key, value, period, sample — never scope internals.
  const metricSnapshotIds = ((artifacts ?? []) as Array<Record<string, unknown>>)
    .map((a) => a.metric_snapshot_id as string | null)
    .filter((id): id is string => Boolean(id));
  const { data: metricRows } = metricSnapshotIds.length
    ? await supabase
        .from("metric_snapshots")
        .select("id, metric_key, value, period_start, period_end, sample_size")
        .in("id", metricSnapshotIds)
    : { data: [] };
  const metricsById = new Map(
    ((metricRows ?? []) as Array<Record<string, unknown>>).map((m) => [m.id as string, m]),
  );

  const resultMetrics: ResultMetric[] = [];
  for (const artifact of (artifacts ?? []) as Array<Record<string, unknown>>) {
    const msId = artifact.metric_snapshot_id as string | null;
    if (!msId) continue;
    const m = metricsById.get(msId);
    if (!m) continue;
    resultMetrics.push({
      key: m.metric_key as string,
      label: (artifact.caption as string | null) ?? (m.metric_key as string),
      value: m.value as number,
      unit: m.metric_key === "gmv" || m.metric_key === "fitarchive_contribution" ? "SGD" : undefined,
      period: `${m.period_start}..${m.period_end}`,
      sample_size: (m.sample_size as number | null) ?? null,
    });
  }

  const publicArtifacts: PublicArtifact[] = (
    (artifacts ?? []) as Array<Record<string, unknown>>
  ).map((a) => ({
    kind: a.kind as PublicArtifact["kind"],
    caption: (a.caption as string | null) ?? null,
    asset_path: (a.asset_path as string | null) ?? null,
    url: (a.url as string | null) ?? null,
    sort_order: (a.sort_order as number) ?? 0,
  }));

  const links = publicArtifacts
    .filter((a) => a.kind === "link" && a.url)
    .map((a) => a.url as string);

  const payload = buildFrozenPayload({
    title: p.title as string,
    oneLineProblem: (p.one_line_problem as string | null) ?? null,
    roleLens,
    roleLensEmphasis: ROLE_LENS_EMPHASIS[roleLens],
    contribution: (p.contribution as string | null) ?? null,
    contextConstraints: (p.context_constraints as string | null) ?? null,
    evidenceGraph: ((p.evidence_links as EvidenceLink[] | null) ?? []),
    evidenceSummary: (p.evidence_summary as string | null) ?? null,
    decision: (p.decision as string | null) ?? null,
    artifacts: publicArtifacts,
    resultMetrics,
    whatChangedNext: (p.what_changed_next as string | null) ?? null,
    limitations: (p.limitations as string | null) ?? null,
    links,
    koDraft: (p.ko_draft as string | null) ?? null,
    koReviewed: (p.ko_reviewed as boolean | null) ?? false,
    frozenAt: new Date().toISOString(),
    sourceProjectId: portfolioProjectId,
  });

  // §15.2 guard: never freeze a payload carrying private keys.
  const privateHits = assertNoPrivateFields(payload);
  if (privateHits) {
    return {
      ok: false,
      error: `Refusing to freeze: private field(s) detected in payload (${privateHits.join(", ")}). §15.2 strips buyer contacts, seller private notes, cost basis and internal financials.`,
    };
  }

  const version = nextSnapshotVersion(
    ((existingSnapshots ?? []) as Array<{ version: number }>).map((s) => s.version),
  );
  const slug = snapshotSlug(p.slug as string, version);

  const { data, error } = await supabase
    .from("portfolio_snapshots")
    .insert({
      portfolio_project_id: portfolioProjectId,
      slug,
      version,
      frozen_payload: payload as unknown as Record<string, unknown>,
      is_public: opts.publish,
      frozen_at: payload.frozen_at,
      published_at: opts.publish ? payload.frozen_at : null,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Snapshot insert failed." };
  }
  return { ok: true, snapshotId: data.id as string, slug, version };
}
