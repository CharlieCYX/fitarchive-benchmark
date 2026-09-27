import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getSessionUser } from "@/lib/auth/session";
import { createRateLimiter } from "@/lib/rate-limit";
import { freezePortfolioSnapshot } from "@/features/portfolio/freeze";

export const dynamic = "force-dynamic";

/**
 * POST /api/portfolio/snapshot — freeze an immutable public snapshot
 * (API map §23.2; §21.2 fields; §6.4 rule 8).
 *
 * Append-only: every freeze inserts a NEW version row with a new slug.
 * Already-frozen snapshots are never rewritten — the DB trigger
 * (protect_frozen_snapshot) rejects payload mutation, and this route never
 * attempts one. Owner-only; §15.2 private-field guard runs before insert.
 */
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });

const bodySchema = z.object({
  portfolio_project_id: z.string().uuid(),
  publish: z.boolean().optional().default(false),
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body must be valid JSON." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "portfolio_project_id (uuid) is required." }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Supabase is not configured — snapshot freeze needs live credentials." },
      { status: 503 },
    );
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Sign in required." }, { status: 401 });
  if (user.role !== "owner") {
    return NextResponse.json({ ok: false, error: "Owner role required to freeze snapshots." }, { status: 403 });
  }

  const supabase = await getServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase is not configured." }, { status: 503 });
  }

  const result = await freezePortfolioSnapshot(supabase, parsed.data.portfolio_project_id, {
    publish: parsed.data.publish,
    actorId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    ok: true,
    snapshot_id: result.snapshotId,
    slug: result.slug,
    version: result.version,
    url: `/portfolio/${result.slug}`,
    frozen: true,
    note: "Frozen snapshots are append-only: later edits to products/metrics never rewrite this snapshot (§6.4 rule 8).",
  });
}
