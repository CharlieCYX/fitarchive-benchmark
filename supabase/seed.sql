-- supabase/seed.sql — deterministic demo seed (skeleton).
--
-- ALL seed data is synthetic and labeled as such (ASSUMPTIONS A20).
-- The full dataset (per DATA_MODEL.md §5 / Build Bible §23.4–23.5: 20–30
-- source listings, 12–15 products FA-001…, 3–4 sellers, Drop #001 live +
-- Drop #002 planned, 2 campaigns, tracked links, 300–500 events, 1 garment
-- case, 1 style user, 2 portfolio snapshots) is built up across Phases 2–9
-- as the corresponding migrations land.
--
-- Phase 1 seeds only the single V1 organization (also created by migration
-- 0002; kept here idempotently for `supabase db reset`).

insert into public.organizations (name, slug)
values ('FitArchive', 'fitarchive')
on conflict (slug) do nothing;
