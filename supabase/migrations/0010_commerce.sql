-- 0010_commerce.sql
-- DATA_MODEL.md §2 (Commerce) + §6 settlement math (§10.4 canonical).
-- RLS policies land in 0013_rls_policies.sql.

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  order_no text not null unique,
  mode order_mode not null,
  status order_status not null default 'pending',
  buyer_profile_id uuid references public.profiles (id) on delete set null,
  buyer_contact jsonb not null default '{}', -- private: name/phone/address; buyer + owner only (§15.3)
  currency text not null default 'SGD',
  subtotal_sgd numeric(12,2) not null default 0,
  shipping_charge_sgd numeric(12,2) not null default 0,
  total_sgd numeric(12,2) not null default 0,
  external_reference text, -- Carousell chat ref / manual receipt no. for external_manual mode
  placed_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict, -- sold items are ledger; never cascade-delete
  unit_price_sgd numeric(12,2) not null,
  quantity int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_items_quantity_pos check (quantity > 0),
  constraint order_items_price_nonneg check (unit_price_sgd >= 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict, -- financial record
  mode order_mode not null,
  provider text not null default 'simulated', -- ADR-004 demo checkout
  status payment_status not null default 'initiated',
  amount_sgd numeric(12,2) not null,
  provider_reference text,
  state_log jsonb not null default '[]', -- append-only state machine transitions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_nonneg check (amount_sgd >= 0)
);

create table if not exists public.refunds_returns (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  order_item_id uuid references public.order_items (id) on delete set null,
  reason text,
  amount_sgd numeric(12,2),
  status text not null default 'requested', -- requested | approved | resolved | rejected
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Settlement ledger (§10.4). Math is canonical and unit-tested:
--   gross_sale_sgd              = sum(order_items.unit_price_sgd) + orders.shipping_charge_sgd
--   seller_base_sgd             = agreements.seller_fixed_amount_sgd
--                                 OR item_sale_price * agreements.seller_share_pct / 100
--   fitarchive_gross_sgd        = gross item price - seller_base_sgd
--   fitarchive_contribution_sgd = fitarchive_gross_sgd - platform_fees_sgd
--                                 - shipping subsidy - campaign variable cost
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers (id) on delete restrict,
  agreement_id uuid not null references public.agreements (id) on delete restrict,
  order_id uuid references public.orders (id) on delete restrict, -- nullable for period-level settlements
  period_start date not null,
  period_end date not null,
  gross_sale_sgd numeric(12,2) not null,
  platform_fees_sgd numeric(12,2) not null default 0,
  seller_base_sgd numeric(12,2) not null,
  fitarchive_gross_sgd numeric(12,2) not null,
  fitarchive_contribution_sgd numeric(12,2) not null,
  status text not null default 'pending', -- pending | paid
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint settlements_period_order check (period_start <= period_end),
  constraint settlements_gross_identity check (fitarchive_gross_sgd = gross_sale_sgd - seller_base_sgd),
  constraint settlements_contribution_cap check (fitarchive_contribution_sgd <= fitarchive_gross_sgd)
);

create index if not exists orders_org_status_idx on public.orders (org_id, status, placed_at desc);
create index if not exists orders_buyer_idx on public.orders (buyer_profile_id) where buyer_profile_id is not null;
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists settlements_seller_idx on public.settlements (seller_id, period_start desc);
create index if not exists settlements_order_idx on public.settlements (order_id) where order_id is not null;
