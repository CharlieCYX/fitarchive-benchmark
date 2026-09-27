# features/analytics — Intelligence + Event Service

Owning module (ARCHITECTURE.md §3) for routes: /studio/analytics, /studio/insights, POST /api/events.
Core tables: events, sessions, insights, experiments, metric_definitions, metric_snapshots.
Status: **event service built — Phase 4**; dashboards land in Phase 5.

Event service (`ingest.ts` pure + `service.ts` server-only): the ONLY writer
to `events`/`sessions` — dictionary-validated ingest (lib/validation/events.ts),
pseudonymous sessions via the `fa_sid` cookie, dedupe via
`upsert(..., onConflict: "org_id,client_event_id", ignoreDuplicates: true)`.
Cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
