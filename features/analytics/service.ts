import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ValidatedEvent } from "@/lib/validation/events";
import {
  ingestEvent,
  type EventWriter,
  type EventRow,
  type IngestResult,
} from "./ingest";

/**
 * Event service (server-only) — the only writer to `events` / `sessions`
 * (ARCHITECTURE §7). Identity: pseudonymous `sessions.anon_id` cookie by
 * default; `profile_id` is attached only from the server-side auth session,
 * never from the client payload (§15.2).
 */

/** Pseudonymous session cookie (A13). Server-set, httpOnly, 1 year. */
export const ANON_SESSION_COOKIE = "fa_sid";
export const ANON_SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 365;

/** Resolve (or create) the sessions row for a pseudonymous anon id. */
export async function resolveSessionId(
  supabase: SupabaseClient,
  orgId: string,
  anonId: string,
  profileId: string | null,
  userAgent: string | null,
  referrer: string | null,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("sessions")
    .select("id")
    .eq("org_id", orgId)
    .eq("anon_id", anonId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    if (profileId) {
      // Attach identity only after real auth — never before (§15.2).
      await supabase
        .from("sessions")
        .update({ profile_id: profileId })
        .eq("id", existing.id as string)
        .is("profile_id", null);
    }
    return existing.id as string;
  }

  const { data: created, error } = await supabase
    .from("sessions")
    .insert({
      org_id: orgId,
      anon_id: anonId,
      profile_id: profileId,
      user_agent: userAgent,
      referrer,
    })
    .select("id")
    .single();
  if (error || !created) return null;
  return created.id as string;
}

/** supabase-js writer implementing the dedupe contract via upsert. */
export function createSupabaseEventWriter(
  supabase: SupabaseClient,
): EventWriter {
  return {
    async upsertEvent(row: EventRow) {
      const { data, error } = await supabase
        .from("events")
        .upsert(row, {
          onConflict: "org_id,client_event_id",
          ignoreDuplicates: true,
        })
        .select("id");
      if (error) return { id: null, error: error.message };
      const id = (data?.[0]?.id as string | undefined) ?? null;
      return { id, error: null };
    },
  };
}

/** Full ingest path: session resolution + deduped event write. */
export async function recordEvent(
  supabase: SupabaseClient,
  orgId: string,
  event: ValidatedEvent,
  identity: {
    anonId: string;
    profileId: string | null;
    userAgent: string | null;
  },
): Promise<IngestResult> {
  const sessionId = await resolveSessionId(
    supabase,
    orgId,
    identity.anonId,
    identity.profileId,
    identity.userAgent,
    event.referrer,
  );
  if (!sessionId) return { ok: false, error: "Could not resolve session." };
  return ingestEvent(createSupabaseEventWriter(supabase), event, {
    orgId,
    sessionId,
    profileId: identity.profileId,
  });
}
