-- 0011_intelligence.sql
-- DATA_MODEL.md §2 (Intelligence & experiments). Mirrors §12.4 experiment object.
-- Also adds the deferred drop_hypotheses.linked_insight_id FK (insights now exists).
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  type insight_type not null, -- observation → hypothesis → experiment → validated_result (§9.2); forecast gated off (A16)
  title text not null,
  body text,
  confidence numeric(3,2),
  owner_id uuid references public.profiles (id) on delete set null,
  sample_size int,
  affected_drop_id uuid references public.drops (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insights_confidence_range check (confidence is null or (confidence >= 0 and confidence <= 1))
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  hypothesis text not null,
  primary_metric text not null, -- metric_definitions.key
  guardrail_metrics text[] not null default '{}',
  unit_of_assignment experiment_unit not null,
  variant_a jsonb not null default '{}',
  variant_b jsonb not null default '{}',
  start_at timestamptz,
  end_at timestamptz,
  sample_target_or_rationale text,
  confounders_notes text,
  status experiment_status not null default 'draft',
  conclusion text,
  conclusion_strength conclusion_strength,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.experiment_assignments (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.experiments (id) on delete cascade,
  unit_key text not null, -- session/product/campaign/drop id, per unit_of_assignment
  variant text not null, -- 'a' | 'b'
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (experiment_id, unit_key)
);

-- Metric registry: one row per canonical metric; the ONLY metric source (ADR-008).
create table if not exists public.metric_definitions (
  key text primary key, -- e.g. 'sell_through'
  name text not null,
  formula text not null,
  denominator text,
  guardrail text,
  sql_view text, -- backing view in 0015_metric_views.sql
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null references public.metric_definitions (key) on delete restrict,
  scope jsonb not null default '{}', -- e.g. {"drop_id": "..."} 
  value numeric,
  period_start date,
  period_end date,
  sample_size int,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Deferred FK from 0007 (insights did not exist yet).
alter table public.drop_hypotheses
  drop constraint if exists drop_hypotheses_linked_insight_id_fkey;
alter table public.drop_hypotheses
  add constraint drop_hypotheses_linked_insight_id_fkey
  foreign key (linked_insight_id) references public.insights (id) on delete set null;

create index if not exists insights_org_type_idx on public.insights (org_id, type, created_at desc);
create index if not exists experiments_org_status_idx on public.experiments (org_id, status);
create index if not exists experiment_assignments_experiment_idx on public.experiment_assignments (experiment_id);
create index if not exists metric_snapshots_key_idx on public.metric_snapshots (metric_key, captured_at desc);
