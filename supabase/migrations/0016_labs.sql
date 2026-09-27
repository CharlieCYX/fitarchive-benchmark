-- 0016_labs.sql
-- DATA_MODEL.md §2 (Garment & product labs). Per §5 dependency notes, tables
-- added after 0013 carry their own RLS enable + policies in-file (owner only).

create table if not exists public.garment_projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  problem_statement text,
  problem_kind text, -- fit | pockets | movement | proportion | modularity | comfort | waste | upcycling
  product_id uuid references public.products (id) on delete set null,
  before_notes text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garment_tests (
  id uuid primary key default gen_random_uuid(),
  garment_project_id uuid not null references public.garment_projects (id) on delete cascade,
  kind text not null, -- wear_test | clo_simulation | prototype_test
  tester_label text, -- pseudonymous only (§15.3)
  consent_obtained boolean not null default false, -- explicit consent required (§15.3)
  context text,
  feedback text,
  discrepancies_vs_simulation text, -- simulated vs physical evidence separation (§9.4)
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.garment_assets (
  id uuid primary key default gen_random_uuid(),
  garment_project_id uuid not null references public.garment_projects (id) on delete cascade,
  kind text not null, -- flat | clo_project | render | fit_map | prototype_photo | before_photo
  asset_path text not null,
  version int not null default 1,
  caption text, -- what the image is intended to show (§9.4)
  ai_generation_id uuid references public.ai_generations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_briefs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  title text not null,
  problem text,
  evidence text,
  current_workaround text,
  target_outcome text,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prds (
  id uuid primary key default gen_random_uuid(),
  product_brief_id uuid not null references public.product_briefs (id) on delete cascade,
  competitor_matrix jsonb not null default '{}',
  user_stories jsonb not null default '[]',
  functional_requirements jsonb not null default '[]',
  nonfunctional_requirements jsonb not null default '[]',
  mvp_scope text,
  deferred_features text,
  success_metrics jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.prototype_tests (
  id uuid primary key default gen_random_uuid(),
  prd_id uuid not null references public.prds (id) on delete cascade,
  prototype_url text, -- e.g. Figma link
  tester_label text, -- pseudonymous
  observation text,
  confusion_notes text,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: lab data is owner-only operational work-in-progress.
alter table public.garment_projects enable row level security;
alter table public.garment_tests enable row level security;
alter table public.garment_assets enable row level security;
alter table public.product_briefs enable row level security;
alter table public.prds enable row level security;
alter table public.prototype_tests enable row level security;

drop policy if exists garment_projects_owner_all on public.garment_projects;
create policy garment_projects_owner_all on public.garment_projects
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists garment_tests_owner_all on public.garment_tests;
create policy garment_tests_owner_all on public.garment_tests
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists garment_assets_owner_all on public.garment_assets;
create policy garment_assets_owner_all on public.garment_assets
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_briefs_owner_all on public.product_briefs;
create policy product_briefs_owner_all on public.product_briefs
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists prds_owner_all on public.prds;
create policy prds_owner_all on public.prds
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists prototype_tests_owner_all on public.prototype_tests;
create policy prototype_tests_owner_all on public.prototype_tests
  for all using (public.is_owner()) with check (public.is_owner());
