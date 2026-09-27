# features/archive — Shopper Archive

Owning module (ARCHITECTURE.md §3) for routes: /archive, /archive/collections/[id].
Core tables: favorites, collections, collection_items, closet_items, style_references.
Status: **live — Phase 6**. UI wiring in `app/(public)/archive`; reads in `service.ts`; mutations in `actions.ts` (closet_item_add event wired).
