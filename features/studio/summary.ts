import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Command Center summary (§7.1) — server-only. Every count comes from a real
 * query; sell-through comes from the canonical metric view (ADR-008). Nothing
 * here is fabricated — when Supabase is unconfigured the page renders the
 * explanatory structure instead.
 */

export interface CommandCenterSummary {
  currentDrop: {
    id: string;
    name: string;
    status: string;
    launch_at: string | null;
    itemCount: number;
  } | null;
  sellThrough: number | null; // v_sell_through for the current drop
  permissionsAwaiting: number;
  productsMissingData: number;
  productsMissingImagery: number;
  assetsAwaitingApproval: number;
  runningExperiments: number;
  recentInsights: Array<{ id: string; type: string; title: string; created_at: string }>;
  failedJobs: number;
  failedJobList: Array<{ id: string; kind: string; last_error: string | null }>;
}

export async function getCommandCenterSummary(
  supabase: SupabaseClient,
): Promise<CommandCenterSummary> {
  const [
    { data: drops },
    permissions,
    missingData,
    products,
    assets,
    experiments,
    { data: insights },
    failedJobs,
  ] = await Promise.all([
    supabase
      .from("drops")
      .select("id, name, status, launch_at, drop_items(count)")
      .in("status", ["published", "scheduled", "ready", "planning"])
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("permissions")
      .select("id", { count: "exact", head: true })
      .eq("state", "contacted"),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .neq("availability", "sold")
      .or("condition_grade.is.null,description_public.is.null"),
    supabase
      .from("products")
      .select("id, product_assets(count)")
      .neq("availability", "sold")
      .limit(500),
    supabase
      .from("campaign_assets")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "draft"),
    supabase
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("status", "running"),
    supabase
      .from("insights")
      .select("id, type, title, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("jobs")
      .select("id, kind, last_error", { count: "exact" })
      .eq("status", "failed")
      .order("run_at", { ascending: false })
      .limit(5),
  ]);

  const drop = (drops?.[0] ?? null) as {
    id: string;
    name: string;
    status: string;
    launch_at: string | null;
    drop_items: Array<{ count: number }> | null;
  } | null;

  // Canonical sell-through from the metric view (lib/metrics METRIC_VIEWS).
  let sellThrough: number | null = null;
  if (drop) {
    const { data: st } = await supabase
      .from("v_sell_through")
      .select("sell_through")
      .eq("drop_id", drop.id)
      .maybeSingle();
    sellThrough =
      st && st.sell_through !== null ? Number(st.sell_through) : null;
  }

  const missingImagery = ((products ?? []) as unknown as Array<{
    product_assets: Array<{ count: number }> | null;
  }>).filter((p) => (p.product_assets?.[0]?.count ?? 0) === 0).length;

  return {
    currentDrop: drop
      ? {
          id: drop.id,
          name: drop.name,
          status: drop.status,
          launch_at: drop.launch_at,
          itemCount: drop.drop_items?.[0]?.count ?? 0,
        }
      : null,
    sellThrough,
    permissionsAwaiting: (permissions.count as number | null) ?? 0,
    productsMissingData: (missingData.count as number | null) ?? 0,
    productsMissingImagery: missingImagery,
    assetsAwaitingApproval: (assets.count as number | null) ?? 0,
    runningExperiments: (experiments.count as number | null) ?? 0,
    recentInsights: (insights ?? []) as CommandCenterSummary["recentInsights"],
    failedJobs: (failedJobs.count as number | null) ?? 0,
    failedJobList: ((failedJobs.data ?? []) as CommandCenterSummary["failedJobList"]),
  };
}
