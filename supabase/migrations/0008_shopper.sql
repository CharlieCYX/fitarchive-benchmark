-- 0008_shopper.sql
-- DATA_MODEL.md §2 (Events & shopper data — shopper side): sessions, favorites,
-- collections, collection_items. The events table itself is 0009.
-- NOTE: collection_items.style_reference_id references style_references (0012);
-- the FK constraint is added in 0012 to keep the migration order acyclic.
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null, -- null = anonymous; pseudonymous by default (A13, §15.2)
  started_at timestamptz not null default now(),
  user_agent text,
  referrer text,
  anon_id text, -- pseudonymous cookie id for anonymous sessions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_org_started_idx on public.sessions (org_id, started_at desc);
create index if not exists sessions_profile_idx on public.sessions (profile_id) where profile_id is not null;
create index if not exists sessions_anon_idx on public.sessions (anon_id) where anon_id is not null;

create table if not exists public.favorites (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (profile_id, product_id)
);

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade, -- null = editorial/operator collection
  title text not null,
  description text,
  is_public boolean not null default false, -- private by default (§8.2, §15.2)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  product_id uuid references public.products (id) on delete cascade,
  style_reference_id uuid, -- FK constraint added in 0012 once style_references exists
  note text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collection_items_one_target check (num_nonnulls(product_id, style_reference_id) = 1)
);

create index if not exists favorites_profile_idx on public.favorites (profile_id);
create index if not exists collections_profile_idx on public.collections (profile_id) where profile_id is not null;
create index if not exists collection_items_collection_idx on public.collection_items (collection_id, position);
