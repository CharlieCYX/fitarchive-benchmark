-- 0004_sellers.sql
-- DATA_MODEL.md §2 (Sellers & permissions): sellers, seller_contacts, agreements.
-- permissions + settlements land in 0006/0010 per migration plan (§5).
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid unique references public.profiles (id) on delete set null, -- portal login; at most one profile per seller (A7)
  handle text not null,
  display_name text not null,
  notes_private text, -- never exposed outside owner (§15.3)
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, handle)
);

create table if not exists public.seller_contacts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete cascade,
  channel text not null, -- carousell | ig | email | phone (§11.1)
  value text not null,
  is_preferred boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete restrict, -- financial ledger: never silently lost (hard-fail §19.3 rule 8)
  type agreement_type not null,
  seller_share_pct numeric(5,2), -- consignment/referral percentage of item sale price
  seller_fixed_amount_sgd numeric(12,2), -- fixed payout alternative (§10.4)
  fulfillment_responsibility text, -- who ships / handles returns
  payout_reference text, -- payout nickname only; no banking secrets (§15.3)
  return_terms text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agreements_terms_present check (seller_share_pct is not null or seller_fixed_amount_sgd is not null or type in ('owned', 'content_collaboration')),
  constraint agreements_share_pct_range check (seller_share_pct is null or (seller_share_pct >= 0 and seller_share_pct <= 100))
);

comment on table public.agreements is
  'Operating-model terms per seller (§10.1). seller_base in settlement math (§6) comes from seller_fixed_amount_sgd OR item_sale_price * seller_share_pct / 100.';

create index if not exists sellers_org_idx on public.sellers (org_id, status);
create index if not exists seller_contacts_seller_idx on public.seller_contacts (seller_id);
create index if not exists agreements_seller_idx on public.agreements (seller_id, status);
