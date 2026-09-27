import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FrozenPayload } from "./snapshot";

/**
 * Portfolio service (§21) — server-only typed queries.
 * Rule §6.4(8): public surfaces read ONLY frozen portfolio_snapshots rows.
 */

export interface PortfolioProjectListRow {
  id: string;
  slug: string;
  title: string;
  role_lens: string | null;
  artifact_count: number;
  snapshot_count: number;
  public_snapshot_slug: string | null;
  created_at: string;
}

export async function listPortfolioProjects(
  supabase: SupabaseClient,
): Promise<PortfolioProjectListRow[]> {
  const { data } = await supabase
    .from("portfolio_projects")
    .select(
      "id, slug, title, role_lens, created_at, portfolio_artifacts(id), portfolio_snapshots(id, slug, is_public)",
    )
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const snapshots = (row.portfolio_snapshots as Array<{ id: string; slug: string; is_public: boolean }> | null) ?? [];
    return {
      id: row.id as string,
      slug: row.slug as string,
      title: row.title as string,
      role_lens: (row.role_lens as string | null) ?? null,
      artifact_count: ((row.portfolio_artifacts as unknown[] | null) ?? []).length,
      snapshot_count: snapshots.length,
      public_snapshot_slug: snapshots.find((s) => s.is_public)?.slug ?? null,
      created_at: row.created_at as string,
    };
  });
}

export interface PortfolioBuilderDetail {
  project: {
    id: string;
    slug: string;
    title: string;
    one_line_problem: string | null;
    role_lens: string | null;
    contribution: string | null;
    context_constraints: string | null;
    evidence_links: unknown[];
    evidence_summary: string | null;
    decision: string | null;
    what_changed_next: string | null;
    limitations: string | null;
    ko_draft: string | null;
    ko_reviewed: boolean;
  };
  artifacts: Array<{
    id: string;
    kind: string;
    asset_path: string | null;
    url: string | null;
    metric_snapshot_id: string | null;
    caption: string | null;
    sort_order: number;
  }>;
  snapshots: Array<{
    id: string;
    slug: string;
    version: number;
    is_public: boolean;
    frozen_at: string;
    published_at: string | null;
  }>;
}

export async function getPortfolioBuilderDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<PortfolioBuilderDetail | null> {
  const { data: project } = await supabase
    .from("portfolio_projects")
    .select(
      "id, slug, title, one_line_problem, role_lens, contribution, context_constraints, evidence_links, evidence_summary, decision, what_changed_next, limitations, ko_draft, ko_reviewed",
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) return null;

  const [{ data: artifacts }, { data: snapshots }] = await Promise.all([
    supabase
      .from("portfolio_artifacts")
      .select("id, kind, asset_path, url, metric_snapshot_id, caption, sort_order")
      .eq("portfolio_project_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("portfolio_snapshots")
      .select("id, slug, version, is_public, frozen_at, published_at")
      .eq("portfolio_project_id", id)
      .order("version", { ascending: false }),
  ]);

  return {
    project: project as PortfolioBuilderDetail["project"],
    artifacts: (artifacts ?? []) as PortfolioBuilderDetail["artifacts"],
    snapshots: (snapshots ?? []) as PortfolioBuilderDetail["snapshots"],
  };
}

export interface PublicSnapshot {
  slug: string;
  version: number;
  frozen_at: string;
  published_at: string | null;
  payload: FrozenPayload;
}

/**
 * Public read path: frozen, published snapshots ONLY (§6.4 rule 8). Uses the
 * request-scoped client — RLS (portfolio_snapshots_public_read) is the
 * enforcement layer; the is_public filter here is defense in depth.
 */
export async function getPublicSnapshotBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<PublicSnapshot | null> {
  const { data } = await supabase
    .from("portfolio_snapshots")
    .select("slug, version, frozen_at, published_at, frozen_payload")
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (!data) return null;
  const row = data as Record<string, unknown>;
  return {
    slug: row.slug as string,
    version: row.version as number,
    frozen_at: row.frozen_at as string,
    published_at: (row.published_at as string | null) ?? null,
    payload: row.frozen_payload as FrozenPayload,
  };
}
