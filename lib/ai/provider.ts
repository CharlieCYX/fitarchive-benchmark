import { z } from "zod";

/**
 * Provider-neutral AI interface (Build Bible §13.1). Pure module — no
 * network, no env access — so the mock adapter and the structured-output
 * validator are unit-testable without a database. Server-side wiring
 * (factory, provenance recording) lives in ./index and ./generations.
 *
 * §13.1 surface: generateText, generateStructured, analyzeImage?, embed?.
 * The mock provider implements text + structured only; image analysis and
 * embeddings are deliberately absent in V1 (no paid keys, §17.3) and callers
 * must feature-check (`if (provider.analyzeImage)`) instead of assuming.
 */

export interface AIPromptRef {
  /** ai_prompt_versions.id when DB-backed; null when running from the registry. */
  id: string | null;
  feature: string;
  version: number;
  systemPrompt: string;
}

export interface AIGenerateRequest {
  /** e.g. "style_engine.build_my_fit" — keys the mock's rule-based behavior. */
  feature: string;
  prompt: AIPromptRef;
  /**
   * Structured, already-resolved inputs (never raw PII). The mock provider
   * composes its deterministic output from this context; real providers
   * receive it rendered into the user template.
   */
  context: Record<string, unknown>;
}

export interface AIGenerateTextResult {
  text: string;
  provider: string;
  model: string;
}

export type AIStructuredResult<T> =
  | { ok: true; data: T; raw: string; provider: string; model: string }
  | {
      ok: false;
      error: string;
      raw: string;
      provider: string;
      model: string;
    };

export interface AIImageInput {
  assetPath: string;
  note?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly model: string;
  generateText(request: AIGenerateRequest): Promise<AIGenerateTextResult>;
  /**
   * Structured generation: the provider returns text that MUST parse as JSON
   * matching `schema`. Implementations validate before resolving — malformed
   * output resolves to `{ ok: false }` and never throws (§19.1 stress test:
   * malformed AI response → safe reject + log).
   */
  generateStructured<T>(
    request: AIGenerateRequest,
    schema: z.ZodType<T>,
  ): Promise<AIStructuredResult<T>>;
  analyzeImage?(
    image: AIImageInput,
    request: AIGenerateRequest,
  ): Promise<AIGenerateTextResult>;
  embed?(texts: string[]): Promise<number[][]>;
}

/* ------------------------------------------------------------------ */
/* Structured-output validation (shared by every provider + gateway)  */
/* ------------------------------------------------------------------ */

/**
 * Extract the JSON payload from provider text: strips ```json fences and
 * leading/trailing prose by slicing the outermost braces. Returns null when
 * no parseable object exists — callers treat that as malformed output.
 */
export function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const candidates = [unfenced];
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start > 0 || (end !== -1 && end < unfenced.length - 1)) {
    if (start !== -1 && end > start) candidates.push(unfenced.slice(start, end + 1));
  }
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export type StructuredValidation<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Validate raw provider text against a zod schema. Safe-reject contract:
 * garbage, prose, truncated JSON or schema mismatches all resolve to
 * `{ ok: false }` with a readable reason — never a throw.
 */
export function validateStructuredOutput<T>(
  raw: string,
  schema: z.ZodType<T>,
): StructuredValidation<T> {
  const parsed = extractJson(raw);
  if (parsed === null) {
    return { ok: false, error: "Provider output was not parseable JSON." };
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `Provider output failed schema validation: ${z.prettifyError(result.error)}`,
    };
  }
  return { ok: true, data: result.data };
}

/* ------------------------------------------------------------------ */
/* Mock provider — the default (A5, §17.3)                             */
/* ------------------------------------------------------------------ */

export const MOCK_PROVIDER_NAME = "mock";
export const MOCK_MODEL = "mock-deterministic-v2";

/**
 * Disclosure marker (§13.4): every mock output is labeled so it can never be
 * mistaken for a real model's output, and every consumer surfaces it.
 */
export const MOCK_DISCLOSURE = "[mock-ai deterministic draft — requires human review]";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function line(label: string, values: string[]): string | null {
  return values.length ? `${label}: ${values.join(", ")}` : null;
}

/**
 * Deterministic rule-based mock (A5). Not lorem ipsum: output is composed
 * from the structured `context` the feature supplies, so it is genuinely
 * useful for wiring, evaluation harnesses and demos without any paid AI.
 * Determinism contract: no clocks, no randomness — identical requests always
 * produce byte-identical output (unit-tested).
 */
export class MockAIProvider implements AIProvider {
  readonly name = MOCK_PROVIDER_NAME;
  readonly model = MOCK_MODEL;

  async generateText(request: AIGenerateRequest): Promise<AIGenerateTextResult> {
    return {
      text: this.composeText(request),
      provider: this.name,
      model: this.model,
    };
  }

  async generateStructured<T>(
    request: AIGenerateRequest,
    schema: z.ZodType<T>,
  ): Promise<AIStructuredResult<T>> {
    const candidate = this.composeStructured(request);
    const raw = JSON.stringify(candidate);
    const validated = validateStructuredOutput(raw, schema);
    if (!validated.ok) {
      return {
        ok: false,
        error: validated.error,
        raw,
        provider: this.name,
        model: this.model,
      };
    }
    return {
      ok: true,
      data: validated.data,
      raw,
      provider: this.name,
      model: this.model,
    };
  }

  private composeText(request: AIGenerateRequest): string {
    const c = request.context;
    switch (request.feature) {
      case "style_engine.build_my_fit": {
        const lines = [
          line("Thesis", asStringArray(c.thesisLines)),
          line("Shared signals", asStringArray(c.sharedSignals)),
          line("Watch-outs", asStringArray(c.contradictions)),
          line("Climate note", asStringArray(c.climateNotes)),
        ].filter((l): l is string => Boolean(l));
        return [
          ...lines,
          `Occasion: ${String(c.occasion ?? "daily")} · Climate: ${String(c.climate ?? "hot-humid")}.`,
          MOCK_DISCLOSURE,
        ].join("\n");
      }
      case "style_engine.decode_reference": {
        const lines = [
          line("Read", asStringArray(c.summaryLines)),
          line("Uncertain", asStringArray(c.uncertainties)),
          line("Singapore translation", asStringArray(c.climateTranslation)),
        ].filter((l): l is string => Boolean(l));
        return [...lines, MOCK_DISCLOSURE].join("\n");
      }
      case "style_engine.can_this_work": {
        return [
          `Verdict: ${String(c.verdict ?? "tension_but_usable")}.`,
          line("Why", asStringArray(c.reasons)),
          line("Repair moves", asStringArray(c.repairMoves)),
          MOCK_DISCLOSURE,
        ]
          .filter((l): l is string => Boolean(l))
          .join("\n");
      }
      case "catalog.description_assistant": {
        return [
          `${String(c.title ?? "Untitled piece")} — ${String(c.condition ?? "condition as noted")}.`,
          line("Details", asStringArray(c.detailLines)),
          "Condition wording is unchanged from the operator record; verify before publishing.",
          MOCK_DISCLOSURE,
        ]
          .filter((l): l is string => Boolean(l))
          .join("\n");
      }
      case "campaign.copy_assistant": {
        return [
          `${String(c.dropName ?? "Upcoming drop")}: ${String(c.concept ?? "editorial concept pending")}.`,
          "Built for 32°C days and 19°C offices.",
          MOCK_DISCLOSURE,
        ].join("\n");
      }
      case "garment.ideation": {
        const problem = String(c.problem_statement ?? "problem statement pending");
        const kind = String(c.problem_kind ?? "fit");
        return [
          `Ideation directions for ${kind} problem: ${problem}`,
          "1. Construction move — adjust the pattern at the failure point, not around it.",
          "2. Material move — swap the stressed component before changing the silhouette.",
          "3. Modular move — make the failing element detachable/replaceable.",
          "Every direction is a hypothesis: none is evidence until a physical wear test (§9.4).",
          MOCK_DISCLOSURE,
        ].join("\n");
      }
      case "portfolio.ko_translation": {
        return [
          `[기계 번역 초안 — 사람 검토 필요] ${String(c.title ?? "제목 없음")}`,
          `원문(EN): ${String(c.text ?? "").slice(0, 500)}`,
          "Note: the mock provider cannot translate; this draft preserves the English source for a human reviewer.",
          MOCK_DISCLOSURE,
        ].join("\n");
      }
      default: {
        const keys = Object.keys(request.context).sort();
        return [
          `Feature "${request.feature}" received context keys: ${keys.join(", ") || "none"}.`,
          "No mock composition rule exists for this feature yet — output is a deterministic echo of its inputs.",
          MOCK_DISCLOSURE,
        ].join("\n");
      }
    }
  }

  private composeStructured(request: AIGenerateRequest): Record<string, unknown> {
    switch (request.feature) {
      case "style_engine.build_my_fit":
        return {
          narrative: this.composeText(request),
          confidence_note:
            "Confidence reflects deterministic signal strength; the mock layer re-words but never re-decides.",
          disclosure: MOCK_DISCLOSURE,
        };
      case "style_engine.decode_reference":
        return {
          narrative: this.composeText(request),
          disclosure: MOCK_DISCLOSURE,
        };
      case "style_engine.can_this_work":
        return {
          narrative: this.composeText(request),
          disclosure: MOCK_DISCLOSURE,
        };
      case "ai_lab.eval":
        return {
          narrative: this.composeText(request),
          disclosure: MOCK_DISCLOSURE,
        };
      case "garment.ideation": {
        const kind = String(request.context.problem_kind ?? "fit");
        return {
          ideas: [
            {
              title: "Construction move",
              concept: `Re-pattern the ${kind} failure point directly; keep the silhouette.`,
              risks: ["pattern complexity", "grading effort"],
            },
            {
              title: "Material move",
              concept: "Swap the stressed component (pocketing, panel, trim) before reshaping.",
              risks: ["hand-feel change", "cost delta"],
            },
            {
              title: "Modular move",
              concept: "Make the failing element detachable or replaceable.",
              risks: ["added hardware", "aesthetic noise"],
            },
          ],
          disclosure: MOCK_DISCLOSURE,
        };
      }
      default:
        return {
          narrative: this.composeText(request),
          disclosure: MOCK_DISCLOSURE,
        };
    }
  }
}

/**
 * Test fixture: a provider whose structured output is always malformed.
 * Used by unit tests and the AI Lab to prove the safe-reject path (§19.1).
 */
export class MalformedAIProvider implements AIProvider {
  readonly name = "malformed-fixture";
  readonly model = "always-broken";

  async generateText(): Promise<AIGenerateTextResult> {
    return { text: "sure! here is some prose with no JSON at all", provider: this.name, model: this.model };
  }

  async generateStructured<T>(
    request: AIGenerateRequest,
    schema: z.ZodType<T>,
  ): Promise<AIStructuredResult<T>> {
    void request;
    void schema;
    const raw = "{ \"narrative\": [\"not-a-string\"], trailing: ,";
    return {
      ok: false,
      error: "Provider output was not parseable JSON.",
      raw,
      provider: this.name,
      model: this.model,
    };
  }
}
