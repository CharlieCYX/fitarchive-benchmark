import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { validateEventPayload } from "@/lib/validation/events";
import {
  ANON_SESSION_COOKIE,
  ANON_SESSION_MAX_AGE_SEC,
  recordEvent,
} from "@/features/analytics/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/events — first-party event ingest (ARCHITECTURE §6,
 * EVENTS_AND_METRICS.md §1).
 *
 * - Zod-validated against the event dictionary: unknown names or missing
 *   required properties → 400.
 * - Dedupe: unique(org_id, client_event_id); replays return
 *   `{ deduped: true }` and never double-count.
 * - Identity: pseudonymous session cookie; profile_id comes only from the
 *   server-side auth session — client-sent identity is never trusted.
 * - Rate-limited per IP (per-instance; see KNOWN_LIMITATIONS).
 * - Graceful 503 (not a crash) when Supabase is unconfigured.
 */

// 120 events/minute/IP — browsing instrumentation, not a bulk channel.
const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

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

  const parsed = validateEventPayload(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Event ingest is not configured: set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.",
      },
      { status: 503 },
    );
  }

  try {
    const supabase = getServiceRoleClient();
    const orgId = await getOrgId(supabase);
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: "No organization row found (run migrations + seed)." },
        { status: 503 },
      );
    }

    // Server-side identity only — the payload's session_id is a hint at best.
    const user = await getSessionUser();
    const profileId = user?.id ?? null;

    const existingAnon = request.cookies.get(ANON_SESSION_COOKIE)?.value;
    const anonId = existingAnon ?? crypto.randomUUID();

    const result = await recordEvent(supabase, orgId, parsed.event, {
      anonId,
      profileId,
      userAgent: request.headers.get("user-agent"),
    });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 500 },
      );
    }

    const response = NextResponse.json(
      { ok: true, id: result.id, deduped: result.status === "deduped" },
      { status: result.status === "inserted" ? 201 : 200 },
    );
    if (!existingAnon) {
      response.cookies.set(ANON_SESSION_COOKIE, anonId, {
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
        error: `Event ingest failed: ${err instanceof Error ? err.message : "unknown error"}`,
      },
      { status: 500 },
    );
  }
}
