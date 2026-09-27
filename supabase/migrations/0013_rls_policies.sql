-- 0013_rls_policies.sql
-- DATA_MODEL.md §2 RLS matrix for every table from 0002–0012.
-- Shorthand: owner = full access · self = row owner · seller-self = rows whose
-- seller chain links to the caller's seller record · public = published-only
-- read · service = service role (bypasses RLS by default; no client policy).
-- Tables added in 0016–0018 carry their own enable+policies in-file.

-- ---------- helpers (security definer → no recursive RLS) ----------
create or replace function public.my_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.has_any_role(variadic roles app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = any (roles)
  );
$$;

-- Seller ids linked to the current user's profile (A7).
create or replace function public.my_seller_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.sellers where user_id = auth.uid();
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.my_seller_ids());
$$;

-- ---------- identity (0002; refine interim policies) ----------
-- profiles: replace interim self-update with non-escalating version.
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id and (role = public.my_role() or public.is_owner()));
-- profiles_self_read / profiles_owner_read_all / organizations_* already exist (0002).

-- ---------- taxonomy (0003) ----------
alter table public.tags enable row level security;
alter table public.tag_aliases enable row level security;
alter table public.tag_assignments enable row level security;

drop policy if exists tags_owner_all on public.tags;
create policy tags_owner_all on public.tags
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists tags_public_read on public.tags;
create policy tags_public_read on public.tags
  for select using (is_active);

drop policy if exists tag_aliases_owner_all on public.tag_aliases;
create policy tag_aliases_owner_all on public.tag_aliases
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists tag_aliases_public_read on public.tag_aliases;
create policy tag_aliases_public_read on public.tag_aliases
  for select using (true);

-- tag_assignments "follows target entity": public sees assignments on published
-- products; sellers see assignments on their own products; owner full.
drop policy if exists tag_assignments_owner_all on public.tag_assignments;
create policy tag_assignments_owner_all on public.tag_assignments
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists tag_assignments_public_read on public.tag_assignments;
create policy tag_assignments_public_read on public.tag_assignments
  for select using (
    entity_type = 'product'
    and exists (
      select 1 from public.products p
      where p.id = entity_id and p.published_at is not null
    )
  );

drop policy if exists tag_assignments_seller_read on public.tag_assignments;
create policy tag_assignments_seller_read on public.tag_assignments
  for select using (
    entity_type = 'product'
    and exists (
      select 1 from public.products p
      where p.id = entity_id and p.seller_id in (select public.my_seller_ids())
    )
  );

-- ---------- sellers (0004) ----------
alter table public.sellers enable row level security;
alter table public.seller_contacts enable row level security;
alter table public.agreements enable row level security;

drop policy if exists sellers_owner_all on public.sellers;
create policy sellers_owner_all on public.sellers
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists sellers_self_read on public.sellers;
create policy sellers_self_read on public.sellers
  for select using (user_id = auth.uid());

drop policy if exists seller_contacts_owner_all on public.seller_contacts;
create policy seller_contacts_owner_all on public.seller_contacts
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists seller_contacts_seller_read on public.seller_contacts;
create policy seller_contacts_seller_read on public.seller_contacts
  for select using (seller_id in (select public.my_seller_ids()));

drop policy if exists agreements_owner_all on public.agreements;
create policy agreements_owner_all on public.agreements
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists agreements_seller_read on public.agreements;
create policy agreements_seller_read on public.agreements
  for select using (seller_id in (select public.my_seller_ids()));

-- ---------- research (0005): owner-only operational data ----------
alter table public.source_platforms enable row level security;
alter table public.source_listings enable row level security;
alter table public.research_observations enable row level security;

drop policy if exists source_platforms_owner_all on public.source_platforms;
create policy source_platforms_owner_all on public.source_platforms
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists source_platforms_public_read on public.source_platforms;
create policy source_platforms_public_read on public.source_platforms
  for select using (true);

drop policy if exists source_listings_owner_all on public.source_listings;
create policy source_listings_owner_all on public.source_listings
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists research_observations_owner_all on public.research_observations;
create policy research_observations_owner_all on public.research_observations
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- catalog (0006) ----------
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_measurements enable row level security;
alter table public.product_assets enable row level security;
alter table public.ownership_records enable row level security;
alter table public.permissions enable row level security;

drop policy if exists products_owner_all on public.products;
create policy products_owner_all on public.products
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select using (published_at is not null);

drop policy if exists products_seller_read on public.products;
create policy products_seller_read on public.products
  for select using (seller_id in (select public.my_seller_ids()));

drop policy if exists product_variants_owner_all on public.product_variants;
create policy product_variants_owner_all on public.product_variants
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.published_at is not null)
  );

drop policy if exists product_variants_seller_read on public.product_variants;
create policy product_variants_seller_read on public.product_variants
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_seller_ids()))
  );

drop policy if exists product_measurements_owner_all on public.product_measurements;
create policy product_measurements_owner_all on public.product_measurements
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_measurements_public_read on public.product_measurements;
create policy product_measurements_public_read on public.product_measurements
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.published_at is not null)
  );

drop policy if exists product_measurements_seller_read on public.product_measurements;
create policy product_measurements_seller_read on public.product_measurements
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_seller_ids()))
  );

drop policy if exists product_assets_owner_all on public.product_assets;
create policy product_assets_owner_all on public.product_assets
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists product_assets_public_read on public.product_assets;
create policy product_assets_public_read on public.product_assets
  for select using (
    privacy = 'public'
    and exists (select 1 from public.products p where p.id = product_id and p.published_at is not null)
  );

drop policy if exists product_assets_seller_read on public.product_assets;
create policy product_assets_seller_read on public.product_assets
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_seller_ids()))
  );

drop policy if exists ownership_records_owner_all on public.ownership_records;
create policy ownership_records_owner_all on public.ownership_records
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists ownership_records_seller_read on public.ownership_records;
create policy ownership_records_seller_read on public.ownership_records
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_seller_ids()))
  );

drop policy if exists permissions_owner_all on public.permissions;
create policy permissions_owner_all on public.permissions
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists permissions_seller_read on public.permissions;
create policy permissions_seller_read on public.permissions
  for select using (seller_id in (select public.my_seller_ids()));

-- ---------- drops & campaigns (0007) ----------
alter table public.drops enable row level security;
alter table public.drop_items enable row level security;
alter table public.drop_hypotheses enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_assets enable row level security;
alter table public.campaign_posts enable row level security;
alter table public.tracked_links enable row level security;

drop policy if exists drops_owner_all on public.drops;
create policy drops_owner_all on public.drops
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists drops_public_read on public.drops;
create policy drops_public_read on public.drops
  for select using (status in ('published', 'closed')); -- paused/planning/scheduled stay private

drop policy if exists drop_items_owner_all on public.drop_items;
create policy drop_items_owner_all on public.drop_items
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists drop_items_public_read on public.drop_items;
create policy drop_items_public_read on public.drop_items
  for select using (
    exists (select 1 from public.drops d where d.id = drop_id and d.status in ('published', 'closed'))
  );

drop policy if exists drop_hypotheses_owner_all on public.drop_hypotheses;
create policy drop_hypotheses_owner_all on public.drop_hypotheses
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists drop_hypotheses_analyst_read on public.drop_hypotheses;
create policy drop_hypotheses_analyst_read on public.drop_hypotheses
  for select using (public.has_any_role('analyst'));

drop policy if exists campaigns_owner_all on public.campaigns;
create policy campaigns_owner_all on public.campaigns
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists campaign_assets_owner_all on public.campaign_assets;
create policy campaign_assets_owner_all on public.campaign_assets
  for all using (public.is_owner()) with check (public.is_owner());

-- Stylist collaborator: scoped read of approved campaign assets (A6).
drop policy if exists campaign_assets_stylist_read on public.campaign_assets;
create policy campaign_assets_stylist_read on public.campaign_assets
  for select using (public.has_any_role('stylist') and approval_status = 'approved');

drop policy if exists campaign_posts_owner_all on public.campaign_posts;
create policy campaign_posts_owner_all on public.campaign_posts
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists campaign_posts_public_read on public.campaign_posts;
create policy campaign_posts_public_read on public.campaign_posts
  for select using (state = 'published' and published_at is not null);

drop policy if exists tracked_links_owner_all on public.tracked_links;
create policy tracked_links_owner_all on public.tracked_links
  for all using (public.is_owner()) with check (public.is_owner());
-- Click tracking writes events via the service role (ADR-008); no client policy.

-- ---------- shopper (0008) ----------
alter table public.sessions enable row level security;
alter table public.favorites enable row level security;
alter table public.collections enable row level security;
alter table public.collection_items enable row level security;

drop policy if exists sessions_owner_read on public.sessions;
create policy sessions_owner_read on public.sessions
  for select using (public.is_owner());

drop policy if exists sessions_self_read on public.sessions;
create policy sessions_self_read on public.sessions
  for select using (profile_id is not null and profile_id = auth.uid());
-- Writes are service-role only (event pipeline, §12.1).

drop policy if exists favorites_self_all on public.favorites;
create policy favorites_self_all on public.favorites
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists favorites_owner_read on public.favorites;
create policy favorites_owner_read on public.favorites
  for select using (public.is_owner());

drop policy if exists collections_self_all on public.collections;
create policy collections_self_all on public.collections
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists collections_owner_all on public.collections;
create policy collections_owner_all on public.collections
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists collections_public_read on public.collections;
create policy collections_public_read on public.collections
  for select using (is_public);

drop policy if exists collection_items_owner_all on public.collection_items;
create policy collection_items_owner_all on public.collection_items
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists collection_items_self_all on public.collection_items;
create policy collection_items_self_all on public.collection_items
  for all using (
    exists (select 1 from public.collections c where c.id = collection_id and c.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.collections c where c.id = collection_id and c.profile_id = auth.uid())
  );

drop policy if exists collection_items_public_read on public.collection_items;
create policy collection_items_public_read on public.collection_items
  for select using (
    exists (select 1 from public.collections c where c.id = collection_id and c.is_public)
  );

-- ---------- events (0009): service-write, owner-read, never public ----------
alter table public.events enable row level security;

drop policy if exists events_owner_read on public.events;
create policy events_owner_read on public.events
  for select using (public.is_owner());
-- No insert/update/delete policies: all writes via service role (bypasses RLS).

-- ---------- commerce (0010) ----------
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.refunds_returns enable row level security;
alter table public.settlements enable row level security;

drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_all on public.orders
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists orders_buyer_read on public.orders;
create policy orders_buyer_read on public.orders
  for select using (buyer_profile_id = auth.uid());

drop policy if exists order_items_owner_all on public.order_items;
create policy order_items_owner_all on public.order_items
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists order_items_buyer_read on public.order_items;
create policy order_items_buyer_read on public.order_items
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_profile_id = auth.uid())
  );

-- Sellers see their own sold line items; buyer fields stay on orders, which
-- sellers cannot read (column-strip by construction, §2 order_items note).
drop policy if exists order_items_seller_read on public.order_items;
create policy order_items_seller_read on public.order_items
  for select using (
    exists (select 1 from public.products p where p.id = product_id and p.seller_id in (select public.my_seller_ids()))
  );

drop policy if exists payments_owner_all on public.payments;
create policy payments_owner_all on public.payments
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists refunds_returns_owner_all on public.refunds_returns;
create policy refunds_returns_owner_all on public.refunds_returns
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists refunds_returns_buyer_read on public.refunds_returns;
create policy refunds_returns_buyer_read on public.refunds_returns
  for select using (
    exists (select 1 from public.orders o where o.id = order_id and o.buyer_profile_id = auth.uid())
  );

drop policy if exists settlements_owner_all on public.settlements;
create policy settlements_owner_all on public.settlements
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists settlements_seller_read on public.settlements;
create policy settlements_seller_read on public.settlements
  for select using (seller_id in (select public.my_seller_ids()));

-- ---------- intelligence (0011) ----------
alter table public.insights enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.metric_definitions enable row level security;
alter table public.metric_snapshots enable row level security;

drop policy if exists insights_owner_all on public.insights;
create policy insights_owner_all on public.insights
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists insights_analyst_read on public.insights;
create policy insights_analyst_read on public.insights
  for select using (public.has_any_role('analyst'));

drop policy if exists experiments_owner_all on public.experiments;
create policy experiments_owner_all on public.experiments
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists experiments_analyst_read on public.experiments;
create policy experiments_analyst_read on public.experiments
  for select using (public.has_any_role('analyst'));

drop policy if exists experiment_assignments_owner_read on public.experiment_assignments;
create policy experiment_assignments_owner_read on public.experiment_assignments
  for select using (public.is_owner());
-- Assignments written by the service role only.

drop policy if exists metric_definitions_public_read on public.metric_definitions;
create policy metric_definitions_public_read on public.metric_definitions
  for select using (true);

drop policy if exists metric_definitions_owner_write on public.metric_definitions;
create policy metric_definitions_owner_write on public.metric_definitions
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists metric_snapshots_owner_all on public.metric_snapshots;
create policy metric_snapshots_owner_all on public.metric_snapshots
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists metric_snapshots_analyst_read on public.metric_snapshots;
create policy metric_snapshots_analyst_read on public.metric_snapshots
  for select using (public.has_any_role('analyst'));

-- ---------- style engine (0012) ----------
alter table public.style_references enable row level security;
alter table public.style_reference_attributes enable row level security;
alter table public.closet_items enable row level security;
alter table public.style_sessions enable row level security;
alter table public.outfits enable row level security;
alter table public.outfit_items enable row level security;
alter table public.style_feedback enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_generations enable row level security;

drop policy if exists style_references_owner_all on public.style_references;
create policy style_references_owner_all on public.style_references
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists style_references_self_all on public.style_references;
create policy style_references_self_all on public.style_references
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists style_ref_attrs_owner_all on public.style_reference_attributes;
create policy style_ref_attrs_owner_all on public.style_reference_attributes
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists style_ref_attrs_self_all on public.style_reference_attributes;
create policy style_ref_attrs_self_all on public.style_reference_attributes
  for all using (
    exists (select 1 from public.style_references r where r.id = style_reference_id and r.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.style_references r where r.id = style_reference_id and r.profile_id = auth.uid())
  );

-- Closet is private by default (§15.2): self only, not even owner read.
drop policy if exists closet_items_self_all on public.closet_items;
create policy closet_items_self_all on public.closet_items
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists style_sessions_owner_read on public.style_sessions;
create policy style_sessions_owner_read on public.style_sessions
  for select using (public.is_owner());

drop policy if exists style_sessions_self_all on public.style_sessions;
create policy style_sessions_self_all on public.style_sessions
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists outfits_owner_read on public.outfits;
create policy outfits_owner_read on public.outfits
  for select using (public.is_owner());

drop policy if exists outfits_self_all on public.outfits;
create policy outfits_self_all on public.outfits
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());

drop policy if exists outfit_items_owner_read on public.outfit_items;
create policy outfit_items_owner_read on public.outfit_items
  for select using (public.is_owner());

drop policy if exists outfit_items_self_all on public.outfit_items;
create policy outfit_items_self_all on public.outfit_items
  for all using (
    exists (select 1 from public.outfits o where o.id = outfit_id and o.profile_id = auth.uid())
  ) with check (
    exists (select 1 from public.outfits o where o.id = outfit_id and o.profile_id = auth.uid())
  );

drop policy if exists style_feedback_owner_read on public.style_feedback;
create policy style_feedback_owner_read on public.style_feedback
  for select using (public.is_owner());

drop policy if exists style_feedback_self_write on public.style_feedback;
create policy style_feedback_self_write on public.style_feedback
  for insert with check (
    exists (select 1 from public.style_sessions s where s.id = style_session_id and s.profile_id = auth.uid())
  );

drop policy if exists style_feedback_self_read on public.style_feedback;
create policy style_feedback_self_read on public.style_feedback
  for select using (
    exists (select 1 from public.style_sessions s where s.id = style_session_id and s.profile_id = auth.uid())
  );

-- ---------- AI governance (0012): owner only, raw output never public ----------
drop policy if exists ai_prompt_versions_owner_all on public.ai_prompt_versions;
create policy ai_prompt_versions_owner_all on public.ai_prompt_versions
  for all using (public.is_owner()) with check (public.is_owner());

drop policy if exists ai_generations_owner_all on public.ai_generations;
create policy ai_generations_owner_all on public.ai_generations
  for all using (public.is_owner()) with check (public.is_owner());

-- ---------- column-level hardening for the anonymous role ----------
-- Postgres column privileges are additive: a column-level REVOKE cannot undo a
-- table-level SELECT grant. So for tables with public read policies that carry
-- private columns, anon gets an explicit column list instead (hard-fail §19.3
-- rule 3). Owner/seller column differentiation is enforced by the API layer +
-- seller-scoped policies above (they share the `authenticated` DB role).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on public.products from anon;
    grant select (id, org_id, slug, sku, title, brand, category_id,
                  condition_grade, defect_notes, description_public,
                  public_price_sgd, seller_id, availability,
                  synthetic_media_present, published_at, created_at, updated_at)
      on public.products to anon;
  end if;
end;
$$;
