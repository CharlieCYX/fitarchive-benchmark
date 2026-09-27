-- 0009_events.sql
-- DATA_MODEL.md §2 (events) + EVENTS_AND_METRICS.md §1.
-- Append-only first-party event store (ADR-008). RLS policies land in
-- 0013_rls_policies.sql (owner read; service-role write only; no public read).

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  event_name text not null, -- dictionary in EVENTS_AND_METRICS.md §1; validated in lib/validation/events.ts
  occurred_at timestamptz not null default now(),
  session_id uuid references public.sessions (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null, -- only when authenticated (§15.2)
  route text,
  referrer text,
  client_event_id uuid not null, -- required on every ingest (§12.1)
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Replay dedupe (§19.1): re-posting the same client_event_id is a no-op
-- (ON CONFLICT DO NOTHING in the ingest path).
create unique index if not exists events_org_client_event_id_key
  on public.events (org_id, client_event_id);

create index if not exists events_name_occurred_idx on public.events (org_id, event_name, occurred_at desc);
create index if not exists events_session_idx on public.events (session_id) where session_id is not null;
create index if not exists events_properties_gin on public.events using gin (properties);

-- Dictionary guard: reject unknown event names at the database boundary too
-- (defense in depth behind the zod schemas in lib/validation/events.ts).
create or replace function public.check_event_name()
returns trigger
language plpgsql
as $$
begin
  if new.event_name not in (
    'page_view', 'drop_view', 'product_impression', 'product_view',
    'product_save', 'product_unsave', 'share_click', 'inquiry_start',
    'external_buy_click', 'checkout_start', 'order_complete',
    'search_submit', 'search_result_click', 'style_session_start',
    'style_result_generated', 'style_feedback', 'closet_item_add',
    'campaign_link_click', 'portfolio_view'
  ) then
    raise exception 'unknown event_name % (see EVENTS_AND_METRICS.md §1)', new.event_name;
  end if;
  return new;
end;
$$;

drop trigger if exists events_check_name on public.events;
create trigger events_check_name
  before insert or update of event_name on public.events
  for each row execute function public.check_event_name();
