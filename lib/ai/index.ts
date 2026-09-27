import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flags } from "@/lib/config/flags";
import { MockAIProvider, type AIProvider } from "./provider";

/**
 * AI provider gateway (server-only, §13). The mock adapter is the default
 * (A5) and the app remains fully functional with it; real adapters
 * (kimi/openai/…) plug in behind this factory without touching callers.
 */
export function getAIProvider(): AIProvider {
  switch (flags.aiProvider) {
    case "mock":
    default:
      return new MockAIProvider();
  }
}

/** sha256 of the exact system prompt — stored on every generation (§13.3). */
export function hashSystemPrompt(systemPrompt: string): string {
  return `sha256:${createHash("sha256").update(systemPrompt).digest("hex").slice(0, 16)}`;
}

/**
 * Resolve the ai_prompt_versions.id for (feature, version) when the DB is
 * reachable; returns null otherwise (registry-only run, provenance kept via
 * the hash + feature/version labels).
 */
export async function resolvePromptVersionId(
  supabase: SupabaseClient,
  feature: string,
  version: number,
): Promise<string | null> {
  const { data } = await supabase
    .from("ai_prompt_versions")
    .select("id")
    .eq("feature", feature)
    .eq("version", version)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type {
  AIProvider,
  AIGenerateRequest,
  AIGenerateTextResult,
  AIStructuredResult,
  AIPromptRef,
} from "./provider";
export { MockAIProvider, MalformedAIProvider, validateStructuredOutput, extractJson } from "./provider";
export { PROMPT_REGISTRY, latestPromptFor, renderUserTemplate, KNOWN_FEATURES } from "./prompts";
