-- 0012_style_ai.sql
-- DATA_MODEL.md §2 (Style Engine + AI governance).
-- ai_prompt_versions / ai_generations are created FIRST because style_sessions
-- references ai_generations. Also adds the FKs deferred from 0007/0008.
-- RLS policies land in 0013_rls_policies.sql.

-- AI governance (§13.3): FitArchive owns prompts and provenance (ADR-003).
create table if not exists public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  feature text not null, -- e.g. 'style_engine.build_my_fit', 'catalog.description_assistant'
  version int not null,
  system_prompt text not null,
  user_template text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (feature, version)
);

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  feature text not null,
  provider text not null, -- 'mock' by default (A5)
  model text not null,
  prompt_version_id uuid references public.ai_prompt_versions (id) on delete set null,
  system_prompt_hash text,
  input_entity_refs jsonb not null default '[]',
  input_asset_refs jsonb not null default '[]',
  output_text text,
  output_asset_path text,
  raw_response_private text, -- raw AI output NEVER public (§20.3)
  created_by uuid references public.profiles (id) on delete set null,
  status ai_generation_status not null default 'draft', -- suggestion until human accepts (§6.4 rule 6)
  human_editor_notes text,
  disclosure_required boolean not null default false,
  disclosure_text text,
  safety_or_truth_flags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Style Engine (§8)
create table if not exists public.style_references (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade, -- null = operator/editorial
  source text not null, -- upload | url
  url text,
  asset_path text, -- private-assets bucket (A12)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_reference_attributes (
  id uuid primary key default gen_random_uuid(),
  style_reference_id uuid not null references public.style_references (id) on delete cascade,
  dimension taxonomy_dimension not null,
  tag_id uuid references public.tags (id) on delete set null,
  free_value text, -- decoded attribute not yet in taxonomy
  confidence numeric(3,2),
  source tag_source not null default 'human',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint style_ref_attr_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.closet_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  category_id uuid references public.tags (id) on delete set null,
  color text,
  fit_notes text,
  photo_asset_path text, -- private-assets bucket; closet is private by default (§15.2)
  wear_frequency text,
  ownership_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,
  mode style_mode not null,
  inputs jsonb not null default '{}', -- references, occasion, climate, budget, owned items (§8.3)
  result jsonb not null default '{}',
  deterministic boolean not null default false, -- deterministic rule engine path (Phase 6)
  ai_generation_id uuid references public.ai_generations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete cascade, -- null = operator/editorial
  style_session_id uuid references public.style_sessions (id) on delete set null,
  title text not null,
  thesis text, -- human-language style thesis (§8.3)
  climate text,
  occasion text,
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.outfit_items (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  closet_item_id uuid references public.closet_items (id) on delete set null,
  style_reference_id uuid references public.style_references (id) on delete set null,
  placeholder_label text, -- when no concrete item exists (AI must not invent inventory, §8.8)
  role text, -- hero | layer | footwear | ...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.style_feedback (
  id uuid primary key default gen_random_uuid(),
  style_session_id uuid not null references public.style_sessions (id) on delete cascade,
  label style_feedback_label not null,
  failure_mode style_failure_mode,
  note text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Deferred FKs now that their targets exist:
alter table public.campaign_assets
  drop constraint if exists campaign_assets_ai_generation_id_fkey;
alter table public.campaign_assets
  add constraint campaign_assets_ai_generation_id_fkey
  foreign key (ai_generation_id) references public.ai_generations (id) on delete set null;

alter table public.collection_items
  drop constraint if exists collection_items_style_reference_id_fkey;
alter table public.collection_items
  add constraint collection_items_style_reference_id_fkey
  foreign key (style_reference_id) references public.style_references (id) on delete cascade;

create index if not exists ai_generations_org_feature_idx on public.ai_generations (org_id, feature, created_at desc);
create index if not exists ai_generations_status_idx on public.ai_generations (status) where status = 'draft';
create index if not exists style_references_profile_idx on public.style_references (profile_id) where profile_id is not null;
create index if not exists style_ref_attrs_reference_idx on public.style_reference_attributes (style_reference_id);
create index if not exists closet_items_profile_idx on public.closet_items (profile_id);
create index if not exists style_sessions_profile_idx on public.style_sessions (profile_id) where profile_id is not null;
create index if not exists outfits_profile_idx on public.outfits (profile_id) where profile_id is not null;
create index if not exists outfit_items_outfit_idx on public.outfit_items (outfit_id);
create index if not exists style_feedback_session_idx on public.style_feedback (style_session_id);
