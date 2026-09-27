import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Product Lab / PRD Studio service (§9.5) — server-only typed queries. */

export interface ProductBriefListRow {
  id: string;
  title: string;
  status: string;
  problem: string | null;
  prd_count: number;
  created_at: string;
}

export async function listProductBriefs(
  supabase: SupabaseClient,
): Promise<ProductBriefListRow[]> {
  const { data } = await supabase
    .from("product_briefs")
    .select("id, title, status, problem, created_at, prds(id)")
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: row.status as string,
    problem: (row.problem as string | null) ?? null,
    prd_count: ((row.prds as unknown[] | null) ?? []).length,
    created_at: row.created_at as string,
  }));
}

export interface ProductBriefDetail {
  brief: {
    id: string;
    title: string;
    problem: string | null;
    evidence: string | null;
    current_workaround: string | null;
    target_outcome: string | null;
    status: string;
  };
  prds: Array<{
    id: string;
    competitor_matrix: unknown;
    user_stories: unknown;
    functional_requirements: unknown;
    nonfunctional_requirements: unknown;
    mvp_scope: string | null;
    deferred_features: string | null;
    success_metrics: unknown;
    instrumentation_plan: string | null;
    releases: Array<{ version: string; released_at: string | null; summary: string; feedback: string | null }>;
    postmortem: string | null;
    created_at: string;
  }>;
  prototypeTests: Array<{
    id: string;
    prd_id: string;
    prototype_url: string | null;
    tester_label: string | null;
    observation: string | null;
    confusion_notes: string | null;
    tested_at: string | null;
  }>;
}

export async function getProductBriefDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<ProductBriefDetail | null> {
  const { data: brief } = await supabase
    .from("product_briefs")
    .select("id, title, problem, evidence, current_workaround, target_outcome, status")
    .eq("id", id)
    .maybeSingle();
  if (!brief) return null;

  const { data: prds } = await supabase
    .from("prds")
    .select(
      "id, competitor_matrix, user_stories, functional_requirements, nonfunctional_requirements, mvp_scope, deferred_features, success_metrics, instrumentation_plan, releases, postmortem, created_at",
    )
    .eq("product_brief_id", id)
    .order("created_at", { ascending: true });

  const prdIds = ((prds ?? []) as Array<{ id: string }>).map((p) => p.id);
  const { data: tests } = prdIds.length
    ? await supabase
        .from("prototype_tests")
        .select("id, prd_id, prototype_url, tester_label, observation, confusion_notes, tested_at")
        .in("prd_id", prdIds)
        .order("tested_at", { ascending: true, nullsFirst: false })
    : { data: [] };

  return {
    brief: brief as ProductBriefDetail["brief"],
    prds: (prds ?? []) as ProductBriefDetail["prds"],
    prototypeTests: (tests ?? []) as ProductBriefDetail["prototypeTests"],
  };
}
