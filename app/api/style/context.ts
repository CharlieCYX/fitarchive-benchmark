import "server-only";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";
import { getServerClient } from "@/lib/db/server";
import { getServiceRoleClient } from "@/lib/db/admin";
import { getOrgId } from "@/lib/db/org";
import { getSessionUser } from "@/lib/auth/session";
import {
  ANON_SESSION_COOKIE,
  resolveSessionId,
} from "@/features/analytics/service";

/**
 * Shared request context for /api/style/* routes (public/session audience,
 * §23.1). Identity mirrors the event service: pseudonymous fa_sid cookie,
 * profile attached only from the server-side auth session (§15.2).
 */

export interface StyleRequestContext {
  configured: boolean;
  supabase: SupabaseClient | null; // RLS-scoped reads
  service: SupabaseClient | null; // service writes (sessions, events)
  orgId: string | null;
  profileId: string | null;
  anonId: string;
  sessionRowId: string | null;
  /** True when the response must set the fa_sid cookie. */
  setAnonCookie: boolean;
}

export async function styleRequestContext(
  request: NextRequest,
): Promise<StyleRequestContext> {
  const existingAnon = request.cookies.get(ANON_SESSION_COOKIE)?.value;
  const anonId = existingAnon ?? crypto.randomUUID();

  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      supabase: null,
      service: null,
      orgId: null,
      profileId: null,
      anonId,
      sessionRowId: null,
      setAnonCookie: false, // no sessions table to key against
    };
  }

  const [supabase, user] = await Promise.all([getServerClient(), getSessionUser()]);
  let service: SupabaseClient | null = null;
  let orgId: string | null = null;
  let sessionRowId: string | null = null;
  try {
    service = getServiceRoleClient();
    orgId = await getOrgId(service);
    if (orgId) {
      sessionRowId = await resolveSessionId(
        service,
        orgId,
        anonId,
        user?.id ?? null,
        request.headers.get("user-agent"),
        request.headers.get("referer"),
      );
    }
  } catch {
    service = null; // service key missing — degrade to read-only
  }

  return {
    configured: true,
    supabase,
    service,
    orgId,
    profileId: user?.id ?? null,
    anonId,
    sessionRowId,
    setAnonCookie: !existingAnon,
  };
}
