import type { ValidatedEvent } from "@/lib/validation/events";

/**
 * Event ingest core (ARCHITECTURE §7: the event service is the ONLY writer
 * to `events`). Pure module — the DB wiring lives in
 * features/analytics/service.ts; the row building and dedupe interpretation
 * are unit-tested here via a fake writer.
 *
 * Dedupe contract (§12.1, §19.1): `unique(org_id, client_event_id)`;
 * replaying the same client_event_id is a no-op that never double-counts.
 */

export interface EventRow {
  org_id: string;
  event_name: string;
  occurred_at: string;
  session_id: string;
  /** Server-resolved identity only — never taken from the client payload. */
  profile_id: string | null;
  route: string | null;
  referrer: string | null;
  client_event_id: string;
  properties: Record<string, unknown>;
}

export interface EventContext {
  orgId: string;
  sessionId: string;
  profileId: string | null;
}

/** Build the `events` insert row from a validated payload + server context. */
export function buildEventRow(
  event: ValidatedEvent,
  ctx: EventContext,
): EventRow {
  return {
    org_id: ctx.orgId,
    event_name: event.event_name,
    occurred_at: event.occurred_at ?? new Date().toISOString(),
    session_id: ctx.sessionId,
    profile_id: ctx.profileId,
    route: event.route,
    referrer: event.referrer,
    client_event_id: event.client_event_id,
    properties: event.properties,
  };
}

export type IngestStatus = "inserted" | "deduped";

/**
 * Minimal writer port — the real implementation upserts with
 * `onConflict: "org_id,client_event_id", ignoreDuplicates: true`, which
 * returns zero rows for a replay. The fake in tests enforces the same
 * unique-key semantics.
 */
export interface EventWriter {
  upsertEvent(row: EventRow): Promise<{ id: string | null; error: string | null }>;
}

export type IngestResult =
  | { ok: true; status: IngestStatus; id: string | null }
  | { ok: false; error: string };

/** Ingest one validated event; a replay resolves to `{ status: "deduped" }`. */
export async function ingestEvent(
  writer: EventWriter,
  event: ValidatedEvent,
  ctx: EventContext,
): Promise<IngestResult> {
  const row = buildEventRow(event, ctx);
  const { id, error } = await writer.upsertEvent(row);
  if (error) return { ok: false, error };
  // ignoreDuplicates upsert returns no row when the conflict key already
  // exists — that is a replay, not a failure.
  return { ok: true, status: id ? "inserted" : "deduped", id };
}

/**
 * In-memory writer used by unit tests to prove the replay contract without a
 * database: same (org_id, client_event_id) twice → second call deduped and
 * the store holds exactly one row.
 */
export function createMemoryEventWriter(): EventWriter & {
  rows: Map<string, EventRow>;
} {
  const rows = new Map<string, EventRow>();
  return {
    rows,
    upsertEvent(row: EventRow) {
      const key = `${row.org_id}:${row.client_event_id}`;
      if (rows.has(key)) return Promise.resolve({ id: null, error: null });
      rows.set(key, row);
      return Promise.resolve({ id: `evt-${rows.size}`, error: null });
    },
  };
}
