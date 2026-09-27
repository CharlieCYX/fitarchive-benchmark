-- 0007_drops_campaigns.sql
-- DATA_MODEL.md §2 (Drops & campaigns): drops, drop_items, drop_hypotheses,
-- campaigns, campaign_assets, campaign_posts, tracked_links.
-- NOTE: campaign_assets.ai_generation_id references ai_generations (0012); the FK
-- constraint is added in 0012 to keep the migration order (§5) acyclic.
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique,
  name text not null, -- e.g. "Drop #001"
  concept text,
  story text,
  hypothesis_summary text, -- every drop is an experiment (§7.5)
  status drop_status not null default 'planning',
  target_size_min int,
  target_size_max int,
  launch_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  cloned_from_id uuid references public.drops (id) on delete set null, -- Drop #002 clones Drop #001 (§7.5)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drops_target_size_range check (target_size_min is null or target_size_max is null or target_size_min <= target_size_max)
);

create table if not exists public.drop_items (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict, -- sold/ledger products must not vanish
  position int not null default 0,
  tier drop_item_tier not null default 'core',
  price_override_sgd numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (drop_id, product_id)
);

create table if not exists public.drop_hypotheses (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops (id) on delete cascade,
  statement text not null,
  expected_outcome text,
  evidence_basis text, -- links the hypothesis back to observed evidence (§9.2 language discipline)
  linked_insight_id uuid, -- FK added in 0011 (insights created there)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  drop_id uuid references public.drops (id) on delete set null,
  name text not null,
  brief text,
  status text not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  kind text not null, -- image | copy | post
  asset_path text,
  version int not null default 1,
  approval_status text not null default 'draft', -- draft | approved | rejected; AI output is suggestion until approved (§7.6)
  ai_generation_id uuid, -- FK constraint added in 0012 once ai_generations exists
  synthetic_disclosed boolean not null default false, -- synthetic imagery disclosure (§7.6)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campaign_posts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  channel text not null, -- instagram | carousell | ssqrd | newsletter | other
  copy text,
  asset_id uuid references public.campaign_assets (id) on delete set null,
  planned_at timestamptz,
  published_at timestamptz,
  state text not null default 'planned', -- planned | published | pulled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  campaign_post_id uuid references public.campaign_posts (id) on delete set null,
  target_url text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  channel text not null,
  code text not null unique, -- short redirect code; every tracked link maps campaign+channel+creative (§7.6)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists drop_items_drop_idx on public.drop_items (drop_id, position);
create index if not exists drop_hypotheses_drop_idx on public.drop_hypotheses (drop_id);
create index if not exists campaigns_drop_idx on public.campaigns (drop_id) where drop_id is not null;
create index if not exists campaign_assets_campaign_idx on public.campaign_assets (campaign_id, approval_status);
create index if not exists campaign_posts_campaign_idx on public.campaign_posts (campaign_id, published_at desc);
create index if not exists campaign_posts_published_idx on public.campaign_posts (published_at desc) where published_at is not null;
create index if not exists tracked_links_campaign_idx on public.tracked_links (campaign_id);
