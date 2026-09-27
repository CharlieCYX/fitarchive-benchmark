# features/product-lab — Product Lab / PRD Studio

Owning module (ARCHITECTURE.md §3) for routes: /studio/product-lab.
Core tables: product_briefs, prds, prototype_tests.
Status: **planned — Phase 8**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
