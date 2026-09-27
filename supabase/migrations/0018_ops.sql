-- 0018_ops.sql
-- DATA_MODEL.md §2 (Ops): audit_log, jobs, system_incidents — plus the shared
-- updated_at trigger machinery and audit triggers for critical tables
-- (permissions, agreements, settlements, publication changes).
-- Own RLS enable + policies in-file (per §5 dependency notes).

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations (id) on delete set null,
  actor_id uuid, -- auth.uid() at write time; null for seed/service contexts
  action text not null, -- insert | update | delete | publication_change | ...
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
  -- append-only: no updated_at, no update/delete policies
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  kind text not null,
  status job_status not null default 'queued',
  payload jsonb not null default '{}',
  retry_count int not null default 0,
  last_error text,
  run_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Doubles as the launch incident log (§7.7, A14).
create table if not exists public.system_incidents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  severity text not null, -- info | minor | major | critical
  title text not null,
  detail text,
  started_at timestamptz not null,
  resolved_at timestamptz,
  annotation_only boolean not null default false, -- offline annotations overlay analytics
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;
alter table public.jobs enable row level security;
alter table public.system_incidents enable row level security;

drop policy if exists audit_log_owner_read on public.audit_log;
create policy audit_log_owner_read on public.audit_log
  for select using (public.is_owner());
-- Writes: service role + audit triggers (security definer) only. Append-only.

drop policy if exists jobs_owner_read on public.jobs;
create policy jobs_owner_read on public.jobs
  for select using (public.is_owner());
-- Writes: service role only (job runner).

drop policy if exists system_incidents_owner_all on public.system_incidents;
create policy system_incidents_owner_all on public.system_incidents
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- updated_at machinery (applies to every entity table) ----------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Attach to every table that carries updated_at (all entity tables, ADR-002).
do $$
declare
  t text;
begin
  foreach t in array array[
    'organizations', 'profiles',
    'tags', 'tag_aliases', 'tag_assignments',
    'sellers', 'seller_contacts', 'agreements',
    'source_platforms', 'source_listings', 'research_observations',
    'products', 'product_variants', 'product_measurements', 'product_assets',
    'ownership_records', 'permissions',
    'drops', 'drop_items', 'drop_hypotheses',
    'campaigns', 'campaign_assets', 'campaign_posts', 'tracked_links',
    'sessions', 'collections', 'collection_items',
    'orders', 'order_items', 'payments', 'refunds_returns', 'settlements',
    'insights', 'experiments', 'metric_definitions', 'metric_snapshots',
    'style_references', 'style_reference_attributes', 'closet_items',
    'style_sessions', 'outfits', 'outfit_items',
    'ai_prompt_versions', 'ai_generations',
    'garment_projects', 'garment_tests', 'garment_assets',
    'product_briefs', 'prds', 'prototype_tests',
    'portfolio_projects', 'portfolio_artifacts', 'portfolio_snapshots',
    'jobs', 'system_incidents'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------- audit machinery (critical tables: §15.1 audit log rule) ----------
create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_entity_id uuid;
  v_org uuid;
begin
  if TG_OP = 'DELETE' then
    v_before := to_jsonb(old);
  elsif TG_OP = 'UPDATE' then
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
  else
    v_after := to_jsonb(new);
  end if;

  v_entity_id := coalesce(
    nullif(v_after ->> 'id', '')::uuid,
    nullif(v_before ->> 'id', '')::uuid
  );
  v_org := coalesce(
    nullif(v_after ->> 'org_id', '')::uuid,
    nullif(v_before ->> 'org_id', '')::uuid,
    (select id from public.organizations where slug = 'fitarchive')
  );

  insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, before, after)
  values (v_org, auth.uid(), lower(TG_OP), TG_TABLE_NAME, v_entity_id, v_before, v_after);

  if TG_OP = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Ledger-critical tables: full insert/update/delete audit.
do $$
declare
  t text;
begin
  foreach t in array array['permissions', 'agreements', 'settlements'] loop
    execute format('drop trigger if exists audit_log_changes on public.%I', t);
    execute format(
      'create trigger audit_log_changes after insert or update or delete on public.%I for each row execute function public.write_audit_log()',
      t
    );
  end loop;
end;
$$;

-- Publication changes (A15): availability/status/published_at transitions on
-- products and drops are auditable state changes (§7.3, §7.7).
create or replace function public.audit_publication_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (to_jsonb(old) ->> 'published_at') is distinct from (to_jsonb(new) ->> 'published_at')
     or (to_jsonb(old) ->> 'status') is distinct from (to_jsonb(new) ->> 'status')
     or (to_jsonb(old) ->> 'availability') is distinct from (to_jsonb(new) ->> 'availability') then
    insert into public.audit_log (org_id, actor_id, action, entity_type, entity_id, before, after)
    values (
      coalesce(nullif(to_jsonb(new) ->> 'org_id', '')::uuid,
               (select id from public.organizations where slug = 'fitarchive')),
      auth.uid(),
      'publication_change',
      TG_TABLE_NAME,
      new.id,
      jsonb_build_object(
        'published_at', to_jsonb(old) -> 'published_at',
        'status', to_jsonb(old) -> 'status',
        'availability', to_jsonb(old) -> 'availability'
      ),
      jsonb_build_object(
        'published_at', to_jsonb(new) -> 'published_at',
        'status', to_jsonb(new) -> 'status',
        'availability', to_jsonb(new) -> 'availability'
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_publication_change on public.products;
create trigger audit_publication_change
  after update on public.products
  for each row execute function public.audit_publication_change();

drop trigger if exists audit_publication_change on public.drops;
create trigger audit_publication_change
  after update on public.drops
  for each row execute function public.audit_publication_change();
