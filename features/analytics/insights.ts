import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { InsightInput } from "@/lib/validation/analytics";
import type { EvidenceState } from "./evidence";

/** Insights service (§9.2) — server-only. Evidence language is constrained
 *  by the type enum; forecast never reaches this layer (validation blocks it). */

export interface InsightRow {
  id: string;
  type: EvidenceState;
  title: string;
  body: string | null;
  confidence: number | null;
  ownerId: string | null;
  ownerName: string | null;
  sampleSize: number | null;
  affectedDropId: string | null;
  affectedDropName: string | null;
  createdAt: string;
}

export async function listInsights(
  supabase: SupabaseClient,
  orgId: string,
): Promise<InsightRow[]> {
  const { data } = await supabase
    .from("insights")
    .select(
      "id, type, title, body, confidence, owner_id, sample_size, affected_drop_id, created_at, drops(name), profiles:owner_id(display_name)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: r.type as EvidenceState,
    title: r.title as string,
    body: (r.body as string | null) ?? null,
    confidence: r.confidence === null ? null : Number(r.confidence),
    ownerId: (r.owner_id as string | null) ?? null,
    ownerName: (r.profiles as { display_name?: string } | null)?.display_name ?? null,
    sampleSize: r.sample_size === null ? null : Number(r.sample_size),
    affectedDropId: (r.affected_drop_id as string | null) ?? null,
    affectedDropName: (r.drops as { name?: string } | null)?.name ?? null,
    createdAt: r.created_at as string,
  }));
}

export interface MutationResult {
  ok: boolean;
  error?: string;
}

export async function createInsight(
  supabase: SupabaseClient,
  orgId: string,
  input: InsightInput,
  actorId: string,
): Promise<MutationResult & { id?: string }> {
  const { data, error } = await supabase
    .from("insights")
    .insert({
      org_id: orgId,
      type: input.type,
      title: input.title,
      body: input.body,
      confidence: input.confidence,
      owner_id: input.owner_id,
      sample_size: input.sample_size,
      affected_drop_id: input.affected_drop_id,
      created_by: actorId,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id as string };
}

export async function updateInsight(
  supabase: SupabaseClient,
  id: string,
  input: InsightInput,
): Promise<MutationResult> {
  const { error } = await supabase
    .from("insights")
    .update({
      type: input.type,
      title: input.title,
      body: input.body,
      confidence: input.confidence,
      owner_id: input.owner_id,
      sample_size: input.sample_size,
      affected_drop_id: input.affected_drop_id,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteInsight(
  supabase: SupabaseClient,
  id: string,
): Promise<MutationResult> {
  const { error } = await supabase.from("insights").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Small selects for forms. */
export async function listDropOptions(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from("drops")
    .select("id, name")
    .order("created_at", { ascending: true });
  return (data ?? []) as Array<{ id: string; name: string }>;
}

export async function listOwnerOptions(
  supabase: SupabaseClient,
): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .in("role", ["owner", "analyst"])
    .order("display_name");
  return ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
    id: p.id as string,
    name: (p.display_name as string | null) ?? "Unnamed",
  }));
}
