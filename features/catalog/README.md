# features/catalog — Catalog / Product Master

Owning module (ARCHITECTURE.md §3) for routes: /studio/catalog + storefront PDP reads.
Core tables: products, product_variants, product_measurements, product_assets, ownership_records.
Status: **planned — Phase 2**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
