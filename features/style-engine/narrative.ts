import { z } from "zod";
import type { AIProvider } from "@/lib/ai/provider";
import type { AIPromptRef } from "@/lib/ai/provider";

/**
 * AI narrative enhancement (§13.4 — human-in-the-loop, AI failure safety).
 *
 * The deterministic engine ALWAYS produces the decision (verdict, items,
 * constraints). The provider may only re-word the narrative. Malformed,
 * unparseable or schema-breaking provider output is safely rejected and the
 * deterministic text stands — flagged so the AI Lab can count it (§19.1
 * malformed-response stress test). Pure module: the provider is injected.
 */

export const styleNarrativeSchema = z.object({
  narrative: z.string().min(1).max(4000),
  confidence_note: z.string().max(500).optional(),
  disclosure: z.string().max(300).optional(),
});

export type StyleNarrative = z.infer<typeof styleNarrativeSchema>;

export interface NarrativeOutcome {
  /** Final narrative to display — AI-enhanced or deterministic fallback. */
  narrative: string;
  /** true when the provider output was used; false on fallback/disabled. */
  aiEnhanced: boolean;
  provider: string;
  model: string;
  /** Raw provider payload for ai_generations.raw_response_private. */
  rawResponse: string | null;
  /** e.g. "malformed_provider_output" — recorded as safety_or_truth_flags. */
  flags: string[];
  error: string | null;
}

/**
 * Attempt an AI narrative pass; fall back to the deterministic text on ANY
 * failure (provider error, timeout-free mock, malformed JSON, schema miss).
 */
export async function enhanceNarrative(args: {
  provider: AIProvider | null; // null = AI disabled
  feature: string;
  prompt: AIPromptRef;
  context: Record<string, unknown>;
  deterministicNarrative: string;
}): Promise<NarrativeOutcome> {
  const fallback: NarrativeOutcome = {
    narrative: args.deterministicNarrative,
    aiEnhanced: false,
    provider: args.prompt ? "none" : "none",
    model: "deterministic",
    rawResponse: null,
    flags: [],
    error: null,
  };
  if (!args.provider) return fallback;

  try {
    const result = await args.provider.generateStructured(
      {
        feature: args.feature,
        prompt: args.prompt,
        context: args.context,
      },
      styleNarrativeSchema,
    );
    if (!result.ok) {
      return {
        ...fallback,
        provider: result.provider,
        model: result.model,
        rawResponse: result.raw,
        flags: ["malformed_provider_output"],
        error: result.error,
      };
    }
    return {
      narrative: `${args.deterministicNarrative}\n\n${result.data.narrative}`,
      aiEnhanced: true,
      provider: result.provider,
      model: result.model,
      rawResponse: result.raw,
      flags: [],
      error: null,
    };
  } catch (err) {
    return {
      ...fallback,
      flags: ["provider_error"],
      error: err instanceof Error ? err.message : "Provider call failed.",
    };
  }
}
