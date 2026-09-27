import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { flags } from "@/lib/config/flags";
import {
  getAIProvider,
  hashSystemPrompt,
  latestPromptFor,
  resolvePromptVersionId,
} from "@/lib/ai";
import { recordGeneration } from "@/lib/ai/generations";
import type { StyleGeneratePayload } from "@/lib/validation/style";
import { buildMyFit, matchGarments } from "./build";
import { assessCompatibility, climateWarnings } from "./compatibility";
import { decodeReference, summarizeDecode } from "./decode";
import { enhanceNarrative } from "./narrative";
import {
  finalizeStyleSession,
  loadCatalogGarments,
  loadClosetGarments,
  persistStyleSession,
} from "./service";
import type { StyleMode } from "./types";

/**
 * Style Engine orchestration (server-only, §8.3–8.5 + §13.4).
 *
 * Order of operations is the honesty contract:
 *   1. deterministic engine decides (constraints, verdicts, matches);
 *   2. the AI provider may re-word the narrative only;
 *   3. everything is persisted with provenance (style_sessions +
 *      ai_generations) when the database is configured.
 *
 * The route works unconfigured: catalog/closet reads are skipped (honest
 * note in the result) and nothing is persisted — the deterministic engine
 * still produces a full result (§17.3).
 */

export interface StyleRunDeps {
  /** User-scoped client (RLS reads) — null when Supabase is unconfigured. */
  supabase: SupabaseClient | null;
  /** Service client for session/event writes (anonymous sessions allowed). */
  service: SupabaseClient | null;
  orgId: string | null;
  profileId: string | null;
  sessionRowId: string | null; // pseudonymous sessions.id for the caller
}

export interface StyleRunOutcome {
  ok: boolean;
  mode: StyleMode;
  result: Record<string, unknown>;
  styleSessionId: string | null;
  aiGenerationId: string | null;
  provider: string;
  model: string;
  persisted: boolean;
  error?: string;
}

export async function runStyleGeneration(
  payload: StyleGeneratePayload,
  deps: StyleRunDeps,
): Promise<StyleRunOutcome> {
  // ---------- 1. load garment context ----------
  let catalogNote: string | null = null;
  let catalog: Awaited<ReturnType<typeof loadCatalogGarments>> = [];
  let closet: Awaited<ReturnType<typeof loadClosetGarments>> = [];
  if (deps.supabase) {
    catalog = await loadCatalogGarments(deps.supabase);
    if (deps.profileId) {
      closet = await loadClosetGarments(deps.supabase, deps.profileId);
    }
  } else {
    catalogNote =
      "Catalog and closet are offline (Supabase not configured) — results use only the attributes you supplied.";
  }

  // ---------- 2. deterministic engine ----------
  const feature = `style_engine.${payload.mode === "build_my_fit" ? "build_my_fit" : payload.mode === "can_this_work" ? "can_this_work" : "decode_reference"}`;
  let deterministicNarrative: string;
  let result: Record<string, unknown>;
  let narrativeContext: Record<string, unknown>;

  if (payload.mode === "build_my_fit") {
    const built = buildMyFit({
      references: payload.references,
      occasion: payload.occasion,
      climate: payload.climate,
      budgetSgd: payload.budgetSgd,
      avoidSilhouettes: payload.avoidSilhouettes,
      ownedItemIds: payload.ownedItemIds,
      owned: closet,
      catalog,
    });
    deterministicNarrative = built.thesis;
    narrativeContext = {
      thesisLines: built.thesisLines,
      sharedSignals: built.sharedSignals,
      contradictions: built.contradictions,
      climateNotes: built.climateNotes,
      occasion: payload.occasion,
      climate: payload.climate,
    };
    result = { ...built, catalogNote };
  } else if (payload.mode === "can_this_work") {
    const assessed = assessCompatibility(payload.itemA, payload.itemB);
    const warnings = climateWarnings([payload.itemA, payload.itemB], payload.climate);
    deterministicNarrative = assessed.assessments.map((a) => a.note).join(" ");
    narrativeContext = {
      verdict: assessed.verdict,
      reasons: assessed.assessments.map((a) => `${a.dimension}: ${a.note}`),
      repairMoves: assessed.repairMoves,
    };
    result = { ...assessed, climateWarnings: warnings, catalogNote };
  } else {
    const decoded = decodeReference(payload.attributes);
    const matchSignals = [
      ...decoded.distinctive,
      ...decoded.incidental,
    ];
    const matches = matchGarments(matchSignals, [...closet, ...catalog]);
    const summaryLines = summarizeDecode(decoded);
    deterministicNarrative = summaryLines.join(" ");
    narrativeContext = {
      summaryLines,
      uncertainties: decoded.uncertainties,
      climateTranslation: decoded.climateTranslation,
    };
    result = { ...decoded, matches, catalogNote };
  }

  // ---------- 3. optional AI narrative (never re-decides) ----------
  const promptSeed = latestPromptFor(feature);
  let narrative = deterministicNarrative;
  let aiEnhanced = false;
  let aiFlags: string[] = [];
  let provider = "deterministic";
  let model = "rules";
  let rawResponse: string | null = null;

  const aiAttempted = payload.useAiNarrative && flags.aiEnabled && promptSeed !== null;
  if (aiAttempted && promptSeed) {
    const outcome = await enhanceNarrative({
      provider: getAIProvider(),
      feature,
      prompt: {
        id: null,
        feature: promptSeed.feature,
        version: promptSeed.version,
        systemPrompt: promptSeed.system_prompt,
      },
      context: narrativeContext,
      deterministicNarrative,
    });
    narrative = outcome.narrative;
    aiEnhanced = outcome.aiEnhanced;
    aiFlags = outcome.flags;
    provider = outcome.provider;
    model = outcome.model;
    rawResponse = outcome.rawResponse;
  }
  result = { ...result, narrative, aiEnhanced };

  // ---------- 4. persist with provenance ----------
  let styleSessionId = payload.style_session_id;
  let aiGenerationId: string | null = null;
  let persisted = false;

  if (deps.service && deps.orgId) {
    if (aiAttempted && promptSeed && provider !== "deterministic") {
      const promptVersionId = await resolvePromptVersionId(
        deps.service,
        promptSeed.feature,
        promptSeed.version,
      );
      const recorded = await recordGeneration(deps.service, {
        orgId: deps.orgId,
        feature,
        provider,
        model,
        promptVersionId,
        systemPromptHash: hashSystemPrompt(promptSeed.system_prompt),
        inputEntityRefs: styleSessionId ? { style_session: styleSessionId } : {},
        outputText: narrative,
        rawResponsePrivate: rawResponse,
        createdBy: deps.profileId,
        // Malformed output is auto-rejected; valid mock output stays a draft.
        status: aiFlags.length ? "rejected" : "draft",
        safetyOrTruthFlags: aiFlags,
      });
      aiGenerationId = recorded.id;
    }

    if (styleSessionId) {
      // Session was pre-created via POST /api/style/sessions — finalize it
      // (ownership-checked) instead of double-counting a new row.
      const finalized = await finalizeStyleSession(deps.service, {
        styleSessionId,
        profileId: deps.profileId,
        sessionRowId: deps.sessionRowId,
        inputs: payload as unknown as Record<string, unknown>,
        result,
        deterministic: !aiEnhanced,
        aiGenerationId,
      });
      persisted = finalized.updated;
      if (!finalized.updated) styleSessionId = null;
    } else {
      const session = await persistStyleSession(deps.service, {
        orgId: deps.orgId,
        profileId: deps.profileId,
        sessionId: deps.sessionRowId,
        mode: payload.mode,
        inputs: payload as unknown as Record<string, unknown>,
        result,
        deterministic: !aiEnhanced,
        aiGenerationId,
      });
      if (session.id) {
        styleSessionId = session.id;
        persisted = true;
      }
    }
  }

  return {
    ok: true,
    mode: payload.mode,
    result,
    styleSessionId,
    aiGenerationId,
    provider,
    model,
    persisted,
  };
}
