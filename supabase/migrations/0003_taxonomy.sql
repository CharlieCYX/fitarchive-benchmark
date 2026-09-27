-- 0003_taxonomy.sql
-- DATA_MODEL.md §2 (Taxonomy) + §4 tag confidence rules.
-- RLS policies land in 0013_rls_policies.sql per migration plan (§5).

create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  dimension taxonomy_dimension not null,
  slug text not null,
  label text not null,
  description text, -- e.g. breathability/layering notes on climate tags (§11.3)
  version int not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, dimension, slug, version)
);

comment on table public.tags is
  'Controlled, versioned taxonomy (§11.3). Old terms stay with is_active=false; never hard-deleted so historical analytics never break (§11.4 rule 4).';

create table if not exists public.tag_aliases (
  id uuid primary key default gen_random_uuid(),
  tag_id uuid not null references public.tags (id) on delete cascade,
  alias text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tag_aliases is
  'Alias → canonical tag mapping, preserved across taxonomy versions (§11.4 rule 4).';

create table if not exists public.tag_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete restrict,
  entity_type text not null, -- 'product' | 'source_listing' | 'style_reference' | 'closet_item' (polymorphic per §11.1)
  entity_id uuid not null,
  source tag_source not null,
  confidence numeric(3,2), -- null for human source (§11.4 rule 1)
  accepted boolean not null default true, -- AI-suggested consequential tags stay false until human review (§11.4 rule 2)
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tag_assignments_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint tag_assignments_ai_confidence check (source <> 'ai_suggestion' or confidence is not null)
);

comment on table public.tag_assignments is
  'Polymorphic tag links. RLS follows the target entity (§2); AI suggestions are not canonical truth until accepted (§11.4).';

create index if not exists tags_org_dimension_idx on public.tags (org_id, dimension) where is_active;
create index if not exists tag_aliases_tag_idx on public.tag_aliases (tag_id);
create index if not exists tag_assignments_entity_idx on public.tag_assignments (entity_type, entity_id);
create index if not exists tag_assignments_tag_idx on public.tag_assignments (tag_id);
create index if not exists tag_assignments_pending_review_idx
  on public.tag_assignments (org_id) where source = 'ai_suggestion' and accepted = false;
