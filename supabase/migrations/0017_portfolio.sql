-- 0017_portfolio.sql
-- DATA_MODEL.md §2 (Portfolio) + ADR-006 frozen snapshots.
-- Own RLS enable + policies in-file (per §5 dependency notes).

create table if not exists public.portfolio_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null unique,
  title text not null,
  one_line_problem text,
  role_lens text, -- merchandising | buying | ecommerce | analytics | fashion_tech | garment | kpop_merch | creative
  contribution text, -- exact contribution wording (§21.2)
  context_constraints text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portfolio_artifacts (
  id uuid primary key default gen_random_uuid(),
  portfolio_project_id uuid not null references public.portfolio_projects (id) on delete cascade,
  kind text not null, -- image | chart | link | metric_snapshot
  asset_path text,
  url text,
  metric_snapshot_id uuid references public.metric_snapshots (id) on delete set null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FROZEN: edits to source data never mutate a snapshot (§6.4 rule 8, ADR-006).
create table if not exists public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_project_id uuid not null references public.portfolio_projects (id) on delete cascade,
  slug text not null unique, -- public URL key (A10)
  version int not null default 1,
  frozen_payload jsonb not null, -- full rendered case study, §21.2 fields; private fields stripped at freeze
  is_public boolean not null default false,
  frozen_at timestamptz not null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_project_id, version)
);

alter table public.portfolio_projects enable row level security;
alter table public.portfolio_artifacts enable row level security;
alter table public.portfolio_snapshots enable row level security;

-- Portfolio projects/artifacts are owner working data; the public surface is
-- frozen snapshots only (ADR-006).
drop policy if exists portfolio_projects_owner_all on public.portfolio_projects;
create policy portfolio_projects_owner_all on public.portfolio_projects
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists portfolio_artifacts_owner_all on public.portfolio_artifacts;
create policy portfolio_artifacts_owner_all on public.portfolio_artifacts
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists portfolio_snapshots_owner_all on public.portfolio_snapshots;
create policy portfolio_snapshots_owner_all on public.portfolio_snapshots
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists portfolio_snapshots_public_read on public.portfolio_snapshots;
create policy portfolio_snapshots_public_read on public.portfolio_snapshots
  for select using (is_public);

-- Immutability enforcement: frozen payloads are append-only — updates to
-- frozen_payload / version / frozen_at are rejected (new version = new row).
create or replace function public.protect_frozen_snapshot()
returns trigger
language plpgsql
as $$
begin
  if old.frozen_at is not null
     and (new.frozen_payload is distinct from old.frozen_payload
          or new.version is distinct from old.version
          or new.frozen_at is distinct from old.frozen_at) then
    raise exception 'portfolio_snapshots are frozen and append-only (§6.4 rule 8); create a new version row instead';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_snapshots_protect_frozen on public.portfolio_snapshots;
create trigger portfolio_snapshots_protect_frozen
  before update on public.portfolio_snapshots
  for each row execute function public.protect_frozen_snapshot();
