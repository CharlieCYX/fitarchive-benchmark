-- 0006_catalog.sql
-- DATA_MODEL.md §2 (Catalog): products, product_variants, product_measurements,
-- product_assets, ownership_records, permissions.
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique, -- public URL key (A10)
  sku text not null unique, -- FA-### (A11)
  title text not null,
  brand text,
  category_id uuid references public.tags (id) on delete restrict, -- must be dimension='category' (§11.4 rule 5; trigger below)
  condition_grade condition_grade,
  defect_notes text, -- public-safe, photo-linked condition truth (§10.5)
  description_public text,
  notes_private text, -- owner-only (RLS column strip handled at API layer; row never public before publish)
  public_price_sgd numeric(12,2),
  cost_basis_sgd numeric(12,2), -- never public (hard-fail §19.3 rule 3)
  seller_id uuid references public.sellers (id) on delete restrict, -- consignment/referral ledger must survive
  availability availability_status not null default 'draft',
  synthetic_media_present boolean not null default false, -- disclosure flag (§10.6)
  published_at timestamptz, -- null = not public; set/cleared on publish/unpublish, audited (A15)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_nonneg check (public_price_sgd is null or public_price_sgd >= 0),
  constraint products_cost_nonneg check (cost_basis_sgd is null or cost_basis_sgd >= 0)
);

-- §11.4 rule 5: category_id must reference a tag with dimension='category'.
create or replace function public.check_product_category_dimension()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.tags
    where id = new.category_id and dimension = 'category'
  ) then
    raise exception 'products.category_id must reference a tags row with dimension = ''category'' (§11.4 rule 5)';
  end if;
  return new;
end;
$$;

drop trigger if exists products_category_dimension on public.products;
create trigger products_category_dimension
  before insert or update of category_id on public.products
  for each row execute function public.check_product_category_dimension();

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null, -- size/color
  sku_suffix text,
  availability availability_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, label)
);

create table if not exists public.product_measurements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null, -- e.g. pit_to_pit, length, shoulder
  value numeric(8,2) not null,
  unit text not null default 'cm', -- centimetres (A8)
  method text, -- free-text measurement method (§10.5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, name)
);

create table if not exists public.product_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade, -- nullable: orphan-safe staging before attach
  bucket text not null, -- public-assets | private-assets (A12)
  path text not null,
  checksum text,
  file_type text,
  privacy text not null default 'private', -- public | private
  alt_text text, -- required before publish (§14.4 alt-text workflow)
  provenance text not null default 'operator', -- operator | seller | ai_synthetic
  synthetic boolean not null default false, -- synthetic imagery disclosed, never hides defects (§10.6)
  rights_note text, -- documented rights for seller media (§15.4)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket, path),
  constraint product_assets_synthetic_provenance check (not synthetic or provenance = 'ai_synthetic')
);

create table if not exists public.ownership_records (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  state permission_state not null,
  effective_from timestamptz not null,
  effective_to timestamptz, -- null = current state; latest row wins (§11.2 derived state)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ownership_records_product_idx on public.ownership_records (product_id, effective_from desc);

-- Permission ledger (§7.4): publishing a non-owned item requires a valid row here.
create table if not exists public.permissions (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete restrict, -- ledger survives seller edits
  product_id uuid references public.products (id) on delete restrict, -- nullable: seller-level scope
  scope text not null, -- representation | media | alteration
  state permission_state not null,
  granted_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  evidence_asset_id uuid references public.product_assets (id) on delete set null, -- screenshot/consent proof
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_org_availability_idx on public.products (org_id, availability);
create index if not exists products_published_idx on public.products (org_id, published_at desc) where published_at is not null;
create index if not exists products_seller_idx on public.products (seller_id) where seller_id is not null;
create index if not exists product_variants_product_idx on public.product_variants (product_id);
create index if not exists product_assets_product_idx on public.product_assets (product_id) where product_id is not null;
create index if not exists permissions_seller_idx on public.permissions (seller_id, state);
create index if not exists permissions_product_idx on public.permissions (product_id) where product_id is not null;
create index if not exists permissions_expiry_idx on public.permissions (expires_at) where expires_at is not null and revoked_at is null;
