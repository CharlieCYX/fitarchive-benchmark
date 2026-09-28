import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import { trackedLinkDisplayUrl } from "@/features/campaigns/service";
import {
  ANON_SESSION_COOKIE,
  ANON_SESSION_MAX_AGE_SEC,
  recordEvent,
} from "@/features/analytics/service";

export const dynamic = "force-dynamic";

/**
 * GET /go/[code] — tracked-link redirect (red-team H4). Resolves the short
 * code to a tracked_links row, emits the `campaign_link_click` event through
 * the same Phase 4 ingest path as /api/events (service-role write, dedupe
 * key, server-side identity only), then 302s to the UTM-tagged target.
 * Unknown/invalid codes and unconfigured Supabase degrade to a safe redirect
 * home — never an error page or an open redirect to an unvalidated URL.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const home = new URL("/", request.url);

  // Codes are slug-shaped (see features/campaigns/utm.ts); anything else is
  // simply unknown.
  if (!isSupabaseConfigured() || !/^[a-z0-9-]{1,96}$/.test(code)) {
    return NextResponse.redirect(home, 302);
  }

  try {
    const supabase = getServiceRoleClient();
    const { data: link } = await supabase
      .from("tracked_links")
      .select("id, target_url, utm_source, utm_medium, utm_campaign, utm_content")
      .eq("code", code)
      .maybeSingle();

    if (!link) return NextResponse.redirect(home, 302);

    // Only ever redirect to an absolute http(s) target.
    let target: URL;
    try {
      target = new URL(
        trackedLinkDisplayUrl(link as Parameters<typeof trackedLinkDisplayUrl>[0]),
      );
    } catch {
      return NextResponse.redirect(home, 302);
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      return NextResponse.redirect(home, 302);
    }

    // Best-effort click event — a tracking failure must never break the
    // redirect (same contract as checkout's event writes).
    const orgId = await getOrgId(supabase);
    const existingAnon = request.cookies.get(ANON_SESSION_COOKIE)?.value;
    const anonId = existingAnon ?? crypto.randomUUID();
    if (orgId) {
      const user = await getSessionUser().catch(() => null);
      await recordEvent(
        supabase,
        orgId,
        {
          event_name: "campaign_link_click",
          client_event_id: crypto.randomUUID(),
          occurred_at: null,
          route: `/go/${code}`,
          referrer: request.headers.get("referer"),
          properties: { tracked_link_id: (link as { id: string }).id },
        },
        {
          anonId,
          profileId: user?.id ?? null,
          userAgent: request.headers.get("user-agent"),
        },
      ).catch(() => undefined);
    }

    const response = NextResponse.redirect(target, 302);
    if (!existingAnon) {
      response.cookies.set(ANON_SESSION_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: ANON_SESSION_MAX_AGE_SEC,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.redirect(home, 302);
  }
}
