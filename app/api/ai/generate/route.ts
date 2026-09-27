import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { flags } from "@/lib/config/flags";
import {
  getAIProvider,
  hashSystemPrompt,
  latestPromptFor,
  resolvePromptVersionId,
} from "@/lib/ai";
import { recordGeneration } from "@/lib/ai/generations";
import { aiGenerateRequestSchema } from "@/lib/validation/style";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate — generic provider gateway (API map §23.2, §13).
 *
 * - Owner-only (AI Lab + operator tooling); shoppers never reach a provider.
 * - Rate-limited (20/min/IP) — AI calls are the expensive path.
 * - Every call logs an ai_generations row with FULL provenance (§13.3):
 *   feature, provider, model, prompt_version_id, system_prompt_hash, input
 *   refs, output, raw_response_private, status (draft until human accepts).
 * - Structured mode validates output against a zod schema; malformed
 *   provider output is safely rejected AND logged as a rejected generation
 *   with the `malformed_provider_output` flag (§19.1 stress test).
 */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

/** Schema for structured gateway calls — mirrors styleNarrativeSchema. */
const gatewayStructuredSchema = z.object({
  narrative: z.string().min(1).max(4000),
  confidence_note: z.string().max(500).optional(),
  disclosure: z.string().max(300).optional(),
});

function clientIp(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: NextRequest) {
  const rate = limiter.check(clientIp(request));
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    );
  }

  if (!flags.aiEnabled) {
    return NextResponse.json(
      { ok: false, error: "AI features are disabled (FEATURE_AI=off)." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be valid JSON." },
      { status: 400 },
    );
  }
  const parsed = aiGenerateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid generate request.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const promptSeed = latestPromptFor(parsed.data.feature);
  if (!promptSeed) {
    return NextResponse.json(
      {
        ok: false,
        error: `Unknown feature "${parsed.data.feature}". Registered: ${["style_engine.build_my_fit", "style_engine.can_this_work", "style_engine.decode_reference", "catalog.description_assistant", "campaign.copy_assistant", "ai_lab.eval"].join(", ")}.`,
      },
      { status: 400 },
    );
  }

  // Owner gate — the provider gateway is never shopper-facing (§15.1).
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Sign in required." },
      { status: 401 },
    );
  }
  if (user.role !== "owner") {
    return NextResponse.json(
      { ok: false, error: "Owner role required for the AI gateway." },
      { status: 403 },
    );
  }

  const provider = getAIProvider();
  const prompt = {
    id: null as string | null,
    feature: promptSeed.feature,
    version: promptSeed.version,
    systemPrompt: promptSeed.system_prompt,
  };

  // ---------- call the provider ----------
  let outputText: string | null = null;
  let rawResponse: string | null = null;
  let malformed: string | null = null;
  try {
    if (parsed.data.mode === "structured") {
      const result = await provider.generateStructured(
        { feature: promptSeed.feature, prompt, context: parsed.data.context },
        gatewayStructuredSchema,
      );
      rawResponse = result.raw;
      if (result.ok) {
        outputText = result.data.narrative;
      } else {
        malformed = result.error;
      }
    } else {
      const result = await provider.generateText({
        feature: promptSeed.feature,
        prompt,
        context: parsed.data.context,
      });
      outputText = result.text;
      rawResponse = result.text;
    }
  } catch (err) {
    malformed = err instanceof Error ? err.message : "Provider call failed.";
  }

  // ---------- provenance: log every call (§13.3) ----------
  let generationId: string | null = null;
  let logged = false;
  if (isSupabaseConfigured()) {
    try {
      const service = getServiceRoleClient();
      const orgId = await getOrgId(service);
      if (orgId) {
        const promptVersionId = await resolvePromptVersionId(
          service,
          promptSeed.feature,
          promptSeed.version,
        );
        const recorded = await recordGeneration(service, {
          orgId,
          feature: promptSeed.feature,
          provider: provider.name,
          model: provider.model,
          promptVersionId,
          systemPromptHash: hashSystemPrompt(promptSeed.system_prompt),
          inputEntityRefs: parsed.data.input_entity_refs,
          outputText,
          rawResponsePrivate: rawResponse ?? malformed,
          createdBy: user.id,
          status: malformed ? "rejected" : "draft",
          disclosureRequired: parsed.data.disclosure_required,
          disclosureText: parsed.data.disclosure_required
            ? "Contains AI-assisted output — review before any public use."
            : null,
          safetyOrTruthFlags: malformed ? ["malformed_provider_output"] : [],
        });
        generationId = recorded.id;
        logged = recorded.id !== null;
      }
    } catch {
      logged = false; // provenance logging failed — response says so
    }
  }

  if (malformed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Provider output failed validation and was rejected safely.",
        detail: malformed,
        generation_id: generationId,
        logged,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    feature: promptSeed.feature,
    provider: provider.name,
    model: provider.model,
    prompt_version: promptSeed.version,
    output: outputText,
    generation_id: generationId,
    status: "draft",
    logged,
  });
}
