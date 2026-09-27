import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import {
  recordEvent,
  ANON_SESSION_COOKIE,
  ANON_SESSION_MAX_AGE_SEC,
} from "@/features/analytics/service";
import { styleGenerateSchema } from "@/lib/validation/style";
import { runStyleGeneration } from "@/features/style-engine/run";
import { styleRequestContext } from "../context";

export const dynamic = "force-dynamic";

/**
 * POST /api/style/generate — run the style engine (API map §23.2).
 * The deterministic constraint engine always runs; the AI provider only
 * re-words narrative text, and malformed provider output is safely rejected
 * (deterministic text stands, flagged in ai_generations). Works fully with
 * the mock provider and degrades to unpersisted results when Supabase is
 * unconfigured (§17.3).
 */
const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Body must be valid JSON." },
      { status: 400 },
    );
  }
  const parsed = styleGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid style generation payload.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 },
    );
  }

  const ctx = await styleRequestContext(request);
  const createdSessionHere = parsed.data.style_session_id === null;

  try {
    const outcome = await runStyleGeneration(parsed.data, {
      supabase: ctx.supabase,
      service: ctx.service,
      orgId: ctx.orgId,
      profileId: ctx.profileId,
      sessionRowId: ctx.sessionRowId,
    });

    // Events (EVENTS_AND_METRICS §1) — only when persistence exists.
    if (ctx.service && ctx.orgId && outcome.persisted && outcome.styleSessionId) {
      const identity = {
        anonId: ctx.anonId,
        profileId: ctx.profileId,
        userAgent: request.headers.get("user-agent"),
      };
      if (createdSessionHere) {
        // The client skipped /api/style/sessions — record the start now so
        // the funnel (start → result → feedback) never has orphan results.
        await recordEvent(
          ctx.service,
          ctx.orgId,
          {
            event_name: "style_session_start",
            client_event_id: crypto.randomUUID(),
            occurred_at: new Date().toISOString(),
            route: new URL(request.url).pathname,
            referrer: request.headers.get("referer"),
            properties: { mode: outcome.mode },
          },
          identity,
        );
      }
      await recordEvent(
        ctx.service,
        ctx.orgId,
        {
          event_name: "style_result_generated",
          client_event_id: crypto.randomUUID(),
          occurred_at: new Date().toISOString(),
          route: new URL(request.url).pathname,
          referrer: request.headers.get("referer"),
          properties: {
            style_session_id: outcome.styleSessionId,
            provider: outcome.provider,
            model: outcome.model,
          },
        },
        identity,
      );
    }

    const response = NextResponse.json({
      ok: true,
      mode: outcome.mode,
      result: outcome.result,
      style_session_id: outcome.styleSessionId,
      persisted: outcome.persisted,
      provider: outcome.provider,
      model: outcome.model,
    });
    if (ctx.setAnonCookie) {
      response.cookies.set(ANON_SESSION_COOKIE, ctx.anonId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: ANON_SESSION_MAX_AGE_SEC,
        path: "/",
      });
    }
    return response;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error ? err.message : "Style engine failed unexpectedly.",
      },
      { status: 500 },
    );
  }
}
