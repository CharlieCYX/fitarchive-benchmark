# features/storefront — Public Drop Storefront

Owning module (ARCHITECTURE.md §3) for routes: /drops, /drops/[slug],
/products/[slug], /search (+ /checkout/[orderId], ADR-009).
Core tables read (published rows only): products, product_measurements,
product_assets, product_variants, ownership_records, drops, drop_items, tags,
tag_assignments; favorites written per-shopper; orders via features/checkout.
Status: **built — Phase 4**. `filters.ts` / `ownership.ts` are pure and
unit-tested; `service.ts` is server-only and scopes every query to published
rows (draft/unpublished slugs 404). Unconfigured Supabase renders the honest
"Connect Supabase" state — never a mock catalog.
