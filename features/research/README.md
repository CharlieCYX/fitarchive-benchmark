# features/research — Marketplace Research Inbox

Owning module (ARCHITECTURE.md §3) for routes: /studio/research.
Core tables: source_platforms, source_listings, research_observations, tags, product_assets.
Status: **planned — Phase 2**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
