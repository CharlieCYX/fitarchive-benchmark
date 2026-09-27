# features/archive — Shopper Archive

Owning module (ARCHITECTURE.md §3) for routes: /archive, /archive/collections/[id].
Core tables: favorites, collections, collection_items, closet_items, style_references.
Status: **planned — Phase 6**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
