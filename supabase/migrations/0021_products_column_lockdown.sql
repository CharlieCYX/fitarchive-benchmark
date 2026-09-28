-- 0021_products_column_lockdown.sql
-- Phase 10 hardening (hard-fail §19.3 rule 3 — red-team finding C1).
--
-- 0013 locked the `anon` role to an explicit public column list on
-- public.products, but `authenticated` kept the Supabase default table-level
-- SELECT grant — so ANY signed-in user (shopper) could read the private
-- columns products.cost_basis_sgd and products.notes_private. Verified live
-- on Postgres during the QA audit.
--
-- Fix:
--  1. Revoke the table-level SELECT on public.products from `authenticated`
--     and re-grant SELECT on the explicit PUBLIC column list only (the same
--     list anon has, plus source_listing_id which 0019 added after 0013).
--     Postgres column privileges are additive with table privileges, so the
--     revoke + column grant combination is what actually closes the hole.
--  2. Re-assert the anon column list so it also covers source_listing_id.
--  3. Owner access to the private columns (Studio catalog edit form) moves
--     to a security-definer RPC that checks public.is_owner() — Postgres
--     column privileges cannot distinguish owner/seller/shopper because they
--     all share the `authenticated` DB role.
--  4. UPDATE/INSERT/DELETE grants are untouched: catalog mutations keep
--     working under the existing owner-only RLS policies.
--
-- Also adds public.data_rights_requests (§15.2): the /settings page records
-- export/delete requests here — self-insert + self-read, owner reads all.

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke select on public.products from authenticated;
    grant select (id, org_id, slug, sku, title, brand, category_id,
                  condition_grade, defect_notes, description_public,
                  public_price_sgd, seller_id, source_listing_id, availability,
                  synthetic_media_present, published_at, created_at, updated_at)
      on public.products to authenticated;
  end if;

  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on public.products from anon;
    grant select (id, org_id, slug, sku, title, brand, category_id,
                  condition_grade, defect_notes, description_public,
                  public_price_sgd, seller_id, source_listing_id, availability,
                  synthetic_media_present, published_at, created_at, updated_at)
      on public.products to anon;
  end if;
end;
$$;

-- Owner-only full-row read (includes cost_basis_sgd + notes_private) for the
-- Studio catalog edit form. Security definer: runs as the table owner, so the
-- column lockdown above does not apply; the is_owner() check is the gate.
-- Non-owner callers get an error, never data.
create or replace function public.get_owner_product_full(p_id uuid)
returns setof public.products
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'forbidden: owner role required';
  end if;
  return query select * from public.products where id = p_id;
end;
$$;

revoke all on function public.get_owner_product_full(uuid) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.get_owner_product_full(uuid) to authenticated;
  end if;
end;
$$;

-- ---------- data rights requests (§15.2 — /settings entry point) ----------
create table if not exists public.data_rights_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('export', 'delete')),
  note text,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.data_rights_requests is
  '§15.2 data rights: self-service export/delete request entry from /settings. Self-insert + self-read; owner processes.';

alter table public.data_rights_requests enable row level security;

drop policy if exists data_rights_requests_self_insert on public.data_rights_requests;
create policy data_rights_requests_self_insert on public.data_rights_requests
  for insert with check (profile_id = auth.uid());

drop policy if exists data_rights_requests_self_read on public.data_rights_requests;
create policy data_rights_requests_self_read on public.data_rights_requests
  for select using (profile_id = auth.uid());

drop policy if exists data_rights_requests_owner_all on public.data_rights_requests;
create policy data_rights_requests_owner_all on public.data_rights_requests
  for all using (public.is_owner()) with check (public.is_owner());

drop trigger if exists set_updated_at on public.data_rights_requests;
create trigger set_updated_at before update on public.data_rights_requests
  for each row execute function public.set_updated_at();
