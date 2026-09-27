-- 0002_identity.sql
-- DATA_MODEL.md §2 (Identity & org): organizations, profiles (+ auto-create
-- trigger on auth signup, default role 'shopper' per ASSUMPTIONS A1/A6).
-- Interim RLS here; the full policy matrix lands in 0013_rls_policies.sql.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Single V1 organization (A3).
insert into public.organizations (name, slug)
values ('FitArchive', 'fitarchive')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id),
  role app_role not null default 'shopper',
  display_name text,
  locale text not null default 'en-SG',
  consent jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile on signup; new users are shoppers by default.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, org_id, display_name)
  values (
    new.id,
    (select id from public.organizations where slug = 'fitarchive'),
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Role check helper that bypasses RLS to avoid recursive policies.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;

-- Interim policies (full matrix in 0013):
-- profiles: self read/update; owner read all (via security-definer helper).
drop policy if exists profiles_self_read on public.profiles;
create policy profiles_self_read on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_owner_read_all on public.profiles;
create policy profiles_owner_read_all on public.profiles
  for select using (public.is_owner());

drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and role = 'shopper' or public.is_owner());
-- Note: self-update may not escalate role; 0013 replaces this with the
-- canonical column-privilege approach.

-- organizations: owner full access; all signed-in users can read the org row.
drop policy if exists organizations_owner_all on public.organizations;
create policy organizations_owner_all on public.organizations
  for all using (public.is_owner());

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select using (auth.uid() is not null);
