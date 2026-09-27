import { NextResponse, type NextRequest } from "next/server";
import { createRateLimiter } from "@/lib/rate-limit";
import { recordEvent, ANON_SESSION_COOKIE, ANON_SESSION_MAX_AGE_SEC } from "@/features/analytics/service";
import { createStyleSessionSchema } from "@/lib/validation/style";
import { persistStyleSession } from "@/features/style-engine/service";
import { styleRequestContext } from "../context";

export const dynamic = "force-dynamic";

/**
 * POST /api/style/sessions — create a style session (API map §23.2).
 * Public/session audience: works for anonymous visitors (pseudonymous
 * session) and signed-in shoppers alike. When Supabase is unconfigured the
 * engine still runs without persistence — the response says so honestly.
 */
const limiter = createRateLimiter({ limit: 30, windowMs: 60_000 });

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
  const parsed = createStyleSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Invalid style session payload." },
      { status: 400 },
    );
  }

  const ctx = await styleRequestContext(request);
  let styleSessionId: string | null = null;

  if (ctx.configured && ctx.service && ctx.orgId) {
    const session = await persistStyleSession(ctx.service, {
      orgId: ctx.orgId,
      profileId: ctx.profileId,
      sessionId: ctx.sessionRowId,
      mode: parsed.data.mode,
      inputs: parsed.data.inputs,
      result: {},
      deterministic: true,
      aiGenerationId: null,
    });
    styleSessionId = session.id;

    // style_session_start (EVENTS_AND_METRICS §1) — best-effort.
    if (styleSessionId) {
      await recordEvent(
        ctx.service,
        ctx.orgId,
        {
          event_name: "style_session_start",
          client_event_id: crypto.randomUUID(),
          occurred_at: new Date().toISOString(),
          route: `/style/${parsed.data.mode === "build_my_fit" ? "build" : parsed.data.mode === "can_this_work" ? "compatibility" : "decode"}`,
          referrer: request.headers.get("referer"),
          properties: { mode: parsed.data.mode },
        },
        {
          anonId: ctx.anonId,
          profileId: ctx.profileId,
          userAgent: request.headers.get("user-agent"),
        },
      );
    }
  }

  const response = NextResponse.json({
    ok: true,
    style_session_id: styleSessionId,
    persisted: styleSessionId !== null,
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
}
