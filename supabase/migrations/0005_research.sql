-- 0005_research.sql
-- DATA_MODEL.md §2 (Research): source_platforms (+ seed rows), source_listings,
-- research_observations. RLS policies land in 0013_rls_policies.sql.

create table if not exists public.source_platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique, -- Carousell | Instagram | SSQRD | manual | physical_market
  kind text not null, -- marketplace | social | discovery | manual | offline
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Fixed platform rows (§5 migration plan). No live integration is implied —
-- these are manual capture sources only (§2.2 MUST-NOT rules, §22).
insert into public.source_platforms (name, kind) values
  ('Carousell', 'marketplace'),
  ('Instagram', 'social'),
  ('SSQRD', 'discovery'),
  ('manual', 'manual'),
  ('physical_market', 'offline')
on conflict (name) do nothing;

create table if not exists public.source_listings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  source_platform_id uuid not null references public.source_platforms (id) on delete restrict,
  source_url text,
  normalized_url text, -- lowercased, tracking params stripped; basis of duplicate detection (§7.2)
  captured_at timestamptz not null,
  seller_handle text,
  seller_id uuid references public.sellers (id) on delete set null, -- link once the seller is a known contact
  title text not null,
  brand text,
  asking_price_sgd numeric(12,2),
  condition_note text,
  visible_engagement int, -- likes/comments visible at capture time
  listing_age_days int,
  permission_state permission_state not null default 'observed_only',
  drop_candidate boolean not null default false,
  is_active boolean not null default true, -- dead listings marked inactive, research preserved (§15.4)
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Duplicate detection (§7.2): one row per normalized URL per org. NULLs allowed
-- (offline/manual captures may have no URL); the data-quality view in 0015
-- surfaces any duplicates that predate normalization.
create unique index if not exists source_listings_org_normalized_url_key
  on public.source_listings (org_id, normalized_url)
  where normalized_url is not null;

create index if not exists source_listings_org_captured_idx on public.source_listings (org_id, captured_at desc);
create index if not exists source_listings_drop_candidate_idx on public.source_listings (org_id) where drop_candidate and is_active;
create index if not exists source_listings_permission_idx on public.source_listings (org_id, permission_state);

create table if not exists public.research_observations (
  id uuid primary key default gen_random_uuid(),
  source_listing_id uuid not null references public.source_listings (id) on delete cascade,
  observed_at timestamptz not null,
  observer_id uuid references public.profiles (id) on delete set null,
  note text not null,
  confidence numeric(3,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint research_observations_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create index if not exists research_observations_listing_idx on public.research_observations (source_listing_id, observed_at desc);
