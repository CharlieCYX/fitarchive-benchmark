# features/drops — Drop Builder + Launch Control

Owning module (ARCHITECTURE.md §3) for routes: /studio/drops, /studio/launch.
Core tables: drops, drop_items, drop_hypotheses.
Status: **planned — Phase 3**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
