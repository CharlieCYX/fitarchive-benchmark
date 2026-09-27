# features/analytics — Intelligence + Event Service

Owning module (ARCHITECTURE.md §3) for routes: /studio/analytics, /studio/insights, POST /api/events.
Core tables: events, insights, experiments, metric_definitions, metric_snapshots.
Status: **planned — Phase 5**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
