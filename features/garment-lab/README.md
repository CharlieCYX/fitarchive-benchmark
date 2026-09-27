# features/garment-lab — Garment Innovation Lab

Owning module (ARCHITECTURE.md §3) for routes: /studio/garments.
Core tables: garment_projects, garment_tests, garment_assets.
Status: **planned — Phase 8**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
