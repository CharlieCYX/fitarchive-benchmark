import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * AI Lab reads (§13.5) — server-only. ai_generations is owner-only by RLS;
 * this module never exposes raw_response_private to list views (§20.3).
 */

export interface PromptVersionRow {
  id: string;
  feature: string;
  version: number;
  system_prompt: string;
  user_template: string;
  created_at: string;
}

export interface GenerationRow {
  id: string;
  feature: string;
  provider: string;
  model: string;
  prompt_version: number | null;
  status: string;
  flags: string[];
  disclosure_required: boolean;
  output_preview: string;
  human_editor_notes: string | null;
  created_at: string;
}

export async function listPromptVersions(
  supabase: SupabaseClient,
): Promise<PromptVersionRow[]> {
  const { data } = await supabase
    .from("ai_prompt_versions")
    .select("id, feature, version, system_prompt, user_template, created_at")
    .order("feature", { ascending: true })
    .order("version", { ascending: false });
  return (data ?? []) as PromptVersionRow[];
}

export async function listGenerations(
  supabase: SupabaseClient,
  limit = 50,
): Promise<GenerationRow[]> {
  // NB: raw_response_private is deliberately not selected — the provenance
  // browser shows provenance + review state, never raw payloads (§20.3).
  const { data } = await supabase
    .from("ai_generations")
    .select("id, feature, provider, model, status, safety_or_truth_flags, disclosure_required, output_text, human_editor_notes, created_at, ai_prompt_versions(version)")
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    feature: row.feature as string,
    provider: row.provider as string,
    model: row.model as string,
    prompt_version:
      (row.ai_prompt_versions as { version: number } | null)?.version ?? null,
    status: row.status as string,
    flags: (row.safety_or_truth_flags as string[] | null) ?? [],
    disclosure_required: row.disclosure_required as boolean,
    output_preview: ((row.output_text as string | null) ?? "").slice(0, 160),
    human_editor_notes: (row.human_editor_notes as string | null) ?? null,
    created_at: row.created_at as string,
  }));
}

export interface GenerationStats {
  total: number;
  byStatus: Record<string, number>;
  flagged: number;
  features: string[];
}

export async function generationStats(
  supabase: SupabaseClient,
): Promise<GenerationStats> {
  const { data } = await supabase
    .from("ai_generations")
    .select("feature, status, safety_or_truth_flags");
  const rows = (data ?? []) as Array<{
    feature: string;
    status: string;
    safety_or_truth_flags: string[] | null;
  }>;
  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1;
  }
  return {
    total: rows.length,
    byStatus,
    flagged: rows.filter((r) => (r.safety_or_truth_flags ?? []).length > 0).length,
    features: [...new Set(rows.map((r) => r.feature))].sort(),
  };
}
