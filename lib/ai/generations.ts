import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ai_generations recording (§13.3 — full provenance on every generation).
 * Every provider call that could influence user-facing output writes a row:
 * feature, provider, model, prompt_version_id, system_prompt_hash, input
 * refs, output, raw_response_private, status (draft until human accept,
 * §6.4 rule 6), disclosure flags and safety/truth flags.
 */

export interface RecordGenerationInput {
  orgId: string;
  feature: string;
  provider: string;
  model: string;
  promptVersionId: string | null;
  systemPromptHash: string;
  inputEntityRefs?: Record<string, unknown>;
  inputAssetRefs?: string[];
  outputText: string | null;
  /** Raw provider payload — NEVER exposed on public surfaces (§20.3). */
  rawResponsePrivate: string | null;
  createdBy: string | null;
  status?: "draft" | "accepted" | "rejected" | "superseded";
  disclosureRequired?: boolean;
  disclosureText?: string | null;
  safetyOrTruthFlags?: string[];
}

export async function recordGeneration(
  supabase: SupabaseClient,
  input: RecordGenerationInput,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("ai_generations")
    .insert({
      org_id: input.orgId,
      feature: input.feature,
      provider: input.provider,
      model: input.model,
      prompt_version_id: input.promptVersionId,
      system_prompt_hash: input.systemPromptHash,
      input_entity_refs: input.inputEntityRefs ?? {},
      input_asset_refs: input.inputAssetRefs ?? [],
      output_text: input.outputText,
      raw_response_private: input.rawResponsePrivate,
      created_by: input.createdBy,
      status: input.status ?? "draft",
      disclosure_required: input.disclosureRequired ?? false,
      disclosure_text: input.disclosureText ?? null,
      safety_or_truth_flags: input.safetyOrTruthFlags ?? [],
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data?.id as string | undefined) ?? null, error: null };
}
