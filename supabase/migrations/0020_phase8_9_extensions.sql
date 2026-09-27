-- 0020_phase8_9_extensions.sql
-- Phase 8–9 additive extensions (precedent: 0019_phase3_links.sql — additive
-- columns/tables only; no contract table or column is renamed or removed).
--
-- 1. garment_projects: structured before/after measurement sets (§9.4
--    before/after comparison) alongside the free-text before_notes.
-- 2. garment_ideation_rounds: one row per AI ideation round (§9.4) carrying
--    prompt, references, selection criteria and operator comments, linked to
--    the full ai_generations provenance row (§13.3).
-- 3. prds: instrumentation plan (success metrics before coding, §9.5),
--    feature build record (releases + feedback), postmortem
--    ("what should not be built").
-- 4. portfolio_projects: evidence-graph links (§21.1) and the optional Korean
--    translation draft, flagged machine-assisted until reviewed (§13.4, §21.2).

alter table public.garment_projects
  add column if not exists measurements_before jsonb not null default '[]',
  add column if not exists measurements_after jsonb not null default '[]';

comment on column public.garment_projects.measurements_before is
  'Structured before-state measurements: [{name, value, unit, method}] (§9.4).';
comment on column public.garment_projects.measurements_after is
  'Structured after-prototype measurements: [{name, value, unit, method}] (§9.4).';

create table if not exists public.garment_ideation_rounds (
  id uuid primary key default gen_random_uuid(),
  garment_project_id uuid not null references public.garment_projects (id) on delete cascade,
  round_number int not null,
  prompt_text text not null,
  reference_notes text, -- references the operator supplied (links, garments, sketches)
  selection_criteria text, -- how the operator will judge the round's output
  operator_comments text, -- post-round review comments
  ai_generation_id uuid references public.ai_generations (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (garment_project_id, round_number)
);

comment on table public.garment_ideation_rounds is
  'AI ideation rounds (§9.4): prompt + references + criteria + comments per round, with ai_generations provenance (§13.3). Output stays a draft suggestion until the operator accepts it (§6.4 rule 6).';

alter table public.garment_ideation_rounds enable row level security;

drop policy if exists garment_ideation_rounds_owner_all on public.garment_ideation_rounds;
create policy garment_ideation_rounds_owner_all on public.garment_ideation_rounds
  for all using (public.is_owner()) with check (public.is_owner());

-- updated_at machinery exists from 0018; attach to the new entity table.
drop trigger if exists set_updated_at on public.garment_ideation_rounds;
create trigger set_updated_at before update on public.garment_ideation_rounds
  for each row execute function public.set_updated_at();

alter table public.prds
  add column if not exists instrumentation_plan text,
  add column if not exists releases jsonb not null default '[]',
  add column if not exists postmortem text;

comment on column public.prds.instrumentation_plan is
  'How each success metric is measured (events, views, period) — written before coding (§9.5).';
comment on column public.prds.releases is
  'Feature build record: [{version, released_at, summary, feedback}] (§9.5 one real feature record).';
comment on column public.prds.postmortem is
  'Postmortem incl. "what should not be built" (§9.5).';

alter table public.portfolio_projects
  add column if not exists evidence_links jsonb not null default '[]',
  add column if not exists evidence_summary text,
  add column if not exists decision text,
  add column if not exists what_changed_next text,
  add column if not exists limitations text,
  add column if not exists ko_draft text,
  add column if not exists ko_reviewed boolean not null default false;

comment on column public.portfolio_projects.evidence_links is
  'Evidence graph (§21.1): [{stage, label, ref_table, ref_id, href}] research → product/drop → campaign → events/metrics → insight → decision → next action.';
comment on column public.portfolio_projects.ko_draft is
  'Optional Korean translation draft (§21.2); machine-assisted until ko_reviewed=true (§13.4).';
