import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Measurement } from "./case-study";

/**
 * Garment Innovation Lab service (§9.4) — server-only typed queries.
 * Pages render real rows only; unconfigured mode is handled by the route.
 */

export interface GarmentProjectListRow {
  id: string;
  title: string;
  problem_kind: string | null;
  status: string;
  product_title: string | null;
  test_count: number;
  asset_count: number;
  round_count: number;
  created_at: string;
}

export async function listGarmentProjects(
  supabase: SupabaseClient,
): Promise<GarmentProjectListRow[]> {
  const { data } = await supabase
    .from("garment_projects")
    .select(
      "id, title, problem_kind, status, created_at, products(title), garment_tests(id), garment_assets(id), garment_ideation_rounds(id)",
    )
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    problem_kind: (row.problem_kind as string | null) ?? null,
    status: row.status as string,
    product_title: (row.products as { title?: string } | null)?.title ?? null,
    test_count: ((row.garment_tests as unknown[] | null) ?? []).length,
    asset_count: ((row.garment_assets as unknown[] | null) ?? []).length,
    round_count: ((row.garment_ideation_rounds as unknown[] | null) ?? []).length,
    created_at: row.created_at as string,
  }));
}

export interface GarmentProjectDetail {
  project: {
    id: string;
    title: string;
    problem_kind: string | null;
    problem_statement: string | null;
    product_id: string | null;
    before_notes: string | null;
    status: string;
    measurements_before: Measurement[];
    measurements_after: Measurement[];
  };
  productTitle: string | null;
  tests: Array<{
    id: string;
    kind: string;
    tester_label: string | null;
    consent_obtained: boolean;
    context: string | null;
    feedback: string | null;
    discrepancies_vs_simulation: string | null;
    tested_at: string | null;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    asset_path: string;
    version: number;
    caption: string | null;
    ai_generation_id: string | null;
  }>;
  rounds: Array<{
    id: string;
    round_number: number;
    prompt_text: string;
    reference_notes: string | null;
    selection_criteria: string | null;
    operator_comments: string | null;
    ai_generation_id: string | null;
    /** Joined provenance (§13.3): provider/model/status of the generation. */
    ai_generations: {
      provider: string;
      model: string;
      status: string;
      output_text: string | null;
      created_at: string;
    } | null;
  }>;
}

export async function getGarmentProjectDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<GarmentProjectDetail | null> {
  const { data: project } = await supabase
    .from("garment_projects")
    .select(
      "id, title, problem_kind, problem_statement, product_id, before_notes, status, measurements_before, measurements_after, products(title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!project) return null;

  const [{ data: tests }, { data: assets }, { data: rounds }] = await Promise.all([
    supabase
      .from("garment_tests")
      .select("id, kind, tester_label, consent_obtained, context, feedback, discrepancies_vs_simulation, tested_at")
      .eq("garment_project_id", id)
      .order("tested_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("garment_assets")
      .select("id, kind, asset_path, version, caption, ai_generation_id")
      .eq("garment_project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("garment_ideation_rounds")
      .select(
        "id, round_number, prompt_text, reference_notes, selection_criteria, operator_comments, ai_generation_id, ai_generations(provider, model, status, output_text, created_at)",
      )
      .eq("garment_project_id", id)
      .order("round_number", { ascending: true }),
  ]);

  const row = project as Record<string, unknown>;
  const { products, ...projectFields } = row;
  return {
    project: {
      ...(projectFields as unknown as GarmentProjectDetail["project"]),
      measurements_before: (row.measurements_before as Measurement[] | null) ?? [],
      measurements_after: (row.measurements_after as Measurement[] | null) ?? [],
    },
    productTitle: (products as { title?: string } | null)?.title ?? null,
    tests: (tests ?? []) as GarmentProjectDetail["tests"],
    assets: (assets ?? []) as GarmentProjectDetail["assets"],
    rounds: ((rounds ?? []) as Array<Record<string, unknown>>).map((r) => ({
      ...(r as unknown as GarmentProjectDetail["rounds"][number]),
      ai_generations:
        (r.ai_generations as GarmentProjectDetail["rounds"][number]["ai_generations"]) ?? null,
    })),
  };
}
