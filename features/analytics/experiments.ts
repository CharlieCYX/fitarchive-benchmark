import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExperimentInput } from "@/lib/validation/analytics";
import {
  concludeError,
  transitionError,
  type ConclusionStrength,
  type ExperimentStatus,
  type ExperimentUnit,
} from "./evidence";

/** Experiments service (§12.4) — server-only. Status moves go through the
 *  pure state machine in ./evidence; conclude requires conclusion + strength. */

export interface ExperimentListRow {
  id: string;
  name: string;
  primaryMetric: string;
  status: ExperimentStatus;
  startAt: string | null;
  endAt: string | null;
  conclusionStrength: ConclusionStrength | null;
}

export async function listExperiments(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ExperimentListRow[]> {
  const { data } = await supabase
    .from("experiments")
    .select("id, name, primary_metric, status, start_at, end_at, conclusion_strength")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    primaryMetric: r.primary_metric as string,
    status: r.status as ExperimentStatus,
    startAt: (r.start_at as string | null) ?? null,
    endAt: (r.end_at as string | null) ?? null,
    conclusionStrength: (r.conclusion_strength as ConclusionStrength | null) ?? null,
  }));
}

export interface ExperimentDetail {
  id: string;
  name: string;
  hypothesis: string;
  primaryMetric: string;
  guardrailMetrics: string[];
  unitOfAssignment: ExperimentUnit;
  variantA: { label?: string; notes?: string };
  variantB: { label?: string; notes?: string };
  startAt: string | null;
  endAt: string | null;
  sampleTargetOrRationale: string | null;
  confoundersNotes: string | null;
  status: ExperimentStatus;
  conclusion: string | null;
  conclusionStrength: ConclusionStrength | null;
  createdAt: string;
  assignments: Array<{ unitKey: string; variant: string; assignedAt: string }>;
}

export async function getExperiment(
  supabase: SupabaseClient,
  id: string,
): Promise<ExperimentDetail | null> {
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const r = data as Record<string, unknown>;
  const { data: assignments } = await supabase
    .from("experiment_assignments")
    .select("unit_key, variant, assigned_at")
    .eq("experiment_id", id)
    .order("assigned_at", { ascending: false })
    .limit(200);
  return {
    id: r.id as string,
    name: r.name as string,
    hypothesis: r.hypothesis as string,
    primaryMetric: r.primary_metric as string,
    guardrailMetrics: (r.guardrail_metrics as string[] | null) ?? [],
    unitOfAssignment: r.unit_of_assignment as ExperimentUnit,
    variantA: (r.variant_a as { label?: string; notes?: string }) ?? {},
    variantB: (r.variant_b as { label?: string; notes?: string }) ?? {},
    startAt: (r.start_at as string | null) ?? null,
    endAt: (r.end_at as string | null) ?? null,
    sampleTargetOrRationale: (r.sample_target_or_rationale as string | null) ?? null,
    confoundersNotes: (r.confounders_notes as string | null) ?? null,
    status: r.status as ExperimentStatus,
    conclusion: (r.conclusion as string | null) ?? null,
    conclusionStrength: (r.conclusion_strength as ConclusionStrength | null) ?? null,
    createdAt: r.created_at as string,
    assignments: ((assignments ?? []) as Array<Record<string, unknown>>).map((a) => ({
      unitKey: a.unit_key as string,
      variant: a.variant as string,
      assignedAt: a.assigned_at as string,
    })),
  };
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export async function createExperiment(
  supabase: SupabaseClient,
  orgId: string,
  input: ExperimentInput,
): Promise<MutationResult & { id?: string }> {
  const { data, error } = await supabase
    .from("experiments")
    .insert({
      org_id: orgId,
      name: input.name,
      hypothesis: input.hypothesis,
      primary_metric: input.primary_metric,
      guardrail_metrics: input.guardrail_metrics,
      unit_of_assignment: input.unit_of_assignment,
      variant_a: { label: input.variant_a_label, notes: input.variant_a_notes },
      variant_b: { label: input.variant_b_label, notes: input.variant_b_notes },
      start_at: input.start_at,
      end_at: input.end_at,
      sample_target_or_rationale: input.sample_target_or_rationale,
      confounders_notes: input.confounders_notes,
      status: "draft",
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function transitionExperiment(
  supabase: SupabaseClient,
  id: string,
  to: ExperimentStatus,
): Promise<MutationResult> {
  const { data } = await supabase
    .from("experiments")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, error: "Experiment not found." };
  const from = (data as Record<string, unknown>).status as ExperimentStatus;
  const err = transitionError(from, to);
  if (err) return { ok: false, error: err };
  const patch: Record<string, unknown> = { status: to };
  if (to === "running" && from === "draft") patch.start_at = new Date().toISOString();
  const { error } = await supabase.from("experiments").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function concludeExperiment(
  supabase: SupabaseClient,
  id: string,
  conclusion: string,
  strength: ConclusionStrength,
): Promise<MutationResult> {
  const { data } = await supabase
    .from("experiments")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { ok: false, error: "Experiment not found." };
  const status = (data as Record<string, unknown>).status as ExperimentStatus;
  const err = concludeError(status, conclusion, strength);
  if (err) return { ok: false, error: err };
  const { error } = await supabase
    .from("experiments")
    .update({
      status: "concluded",
      conclusion,
      conclusion_strength: strength,
      end_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
