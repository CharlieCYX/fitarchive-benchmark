# features/portfolio — Portfolio Mode

Owning module (ARCHITECTURE.md §3) for routes: /studio/portfolio, /portfolio/[slug].
Core tables: portfolio_projects, portfolio_artifacts, portfolio_snapshots.
Status: **planned — Phase 9**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
