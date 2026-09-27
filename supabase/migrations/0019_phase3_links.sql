-- 0019_phase3_links.sql
-- Phase 3 (Operator core): products.source_listing_id links a catalog product
-- back to the source listing it was promoted from (§7.2 promote → §7.3
-- "linked source listings"). Nullable; existing rows unaffected.
-- RLS: products policies (0013) already govern the row; no new policy needed.

alter table public.products
  add column if not exists source_listing_id uuid
  references public.source_listings (id) on delete set null;

create index if not exists products_source_listing_idx
  on public.products (source_listing_id)
  where source_listing_id is not null;

comment on column public.products.source_listing_id is
  'Source listing this product was promoted from (§7.2 → §7.3 lineage). Set once by the promote action; never rewritten.';
