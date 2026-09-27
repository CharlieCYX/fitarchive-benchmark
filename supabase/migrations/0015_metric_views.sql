-- 0015_metric_views.sql
-- EVENTS_AND_METRICS.md §2 canonical metrics, implemented literally as SQL views,
-- plus §12.3 data-quality views and the metric_definitions registry rows.
-- These views are the ONLY metric source (ADR-008): UI reads them via lib/metrics,
-- never recomputes. Views carry org_id so callers filter by @org_id (§2 preamble).
-- All views use security_invoker so underlying RLS still applies (defense in depth).

-- product_view_rate: views / impressions per product × drop × day.
-- Secondary: unique-session view rate (guardrail: use as secondary metric).
create or replace view public.v_product_view_rate
with (security_invoker = true) as
with impressions as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         nullif(properties ->> 'drop_id', '')::uuid as drop_id,
         occurred_at::date as period_day,
         count(*) as impressions
  from public.events
  where event_name = 'product_impression'
  group by 1, 2, 3, 4
),
views as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         nullif(properties ->> 'drop_id', '')::uuid as drop_id,
         occurred_at::date as period_day,
         count(*) as product_views,
         count(distinct session_id) as unique_view_sessions
  from public.events
  where event_name = 'product_view'
  group by 1, 2, 3, 4
)
select coalesce(v.org_id, i.org_id) as org_id,
       coalesce(v.product_id, i.product_id) as product_id,
       coalesce(v.drop_id, i.drop_id) as drop_id,
       coalesce(v.period_day, i.period_day) as period_day,
       coalesce(i.impressions, 0) as impressions,
       coalesce(v.product_views, 0) as product_views,
       coalesce(v.unique_view_sessions, 0) as unique_view_sessions,
       case when coalesce(i.impressions, 0) > 0
            then round(v.product_views::numeric / i.impressions, 4) end as view_rate,
       case when coalesce(i.impressions, 0) > 0
            then round(v.unique_view_sessions::numeric / i.impressions, 4) end as unique_session_view_rate
from views v
full outer join impressions i
  on i.org_id = v.org_id and i.product_id = v.product_id
 and i.drop_id is not distinct from v.drop_id and i.period_day = v.period_day;

-- save_rate: distinct saving identities / product views, per product.
-- Identity basis = authenticated profile else pseudonymous session (stated on charts).
create or replace view public.v_save_rate
with (security_invoker = true) as
with saves as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         count(distinct coalesce(profile_id::text, session_id::text)) as saving_identities
  from public.events
  where event_name = 'product_save'
  group by 1, 2
),
views as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         count(*) as product_views
  from public.events
  where event_name = 'product_view'
  group by 1, 2
)
select v.org_id,
       v.product_id,
       coalesce(s.saving_identities, 0) as saving_identities,
       v.product_views,
       case when v.product_views > 0
            then round(coalesce(s.saving_identities, 0)::numeric / v.product_views, 4) end as save_rate,
       'user_or_session'::text as identity_basis
from views v
left join saves s on s.org_id = v.org_id and s.product_id = v.product_id;

-- inquiry_rate: inquiry_start / product_view per product × drop.
-- Primary conversion proxy when transactions happen off-platform.
create or replace view public.v_inquiry_rate
with (security_invoker = true) as
with inquiries as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         nullif(properties ->> 'drop_id', '')::uuid as drop_id,
         count(*) as inquiries
  from public.events
  where event_name = 'inquiry_start'
  group by 1, 2, 3
),
views as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         nullif(properties ->> 'drop_id', '')::uuid as drop_id,
         count(*) as product_views
  from public.events
  where event_name = 'product_view'
  group by 1, 2, 3
)
select v.org_id,
       v.product_id,
       coalesce(iq.drop_id, v.drop_id) as drop_id,
       coalesce(iq.inquiries, 0) as inquiries,
       v.product_views,
       case when v.product_views > 0
            then round(coalesce(iq.inquiries, 0)::numeric / v.product_views, 4) end as inquiry_rate
from views v
left join inquiries iq
  on iq.org_id = v.org_id and iq.product_id = v.product_id
 and iq.drop_id is not distinct from v.drop_id;

-- external_ctr: external_buy_click / product_view per product × destination.
create or replace view public.v_external_ctr
with (security_invoker = true) as
with clicks as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         properties ->> 'destination' as destination,
         count(*) as external_buy_clicks
  from public.events
  where event_name = 'external_buy_click'
  group by 1, 2, 3
),
views as (
  select org_id,
         (properties ->> 'product_id')::uuid as product_id,
         count(*) as product_views
  from public.events
  where event_name = 'product_view'
  group by 1, 2
)
select c.org_id,
       c.product_id,
       c.destination,
       c.external_buy_clicks,
       v.product_views,
       case when v.product_views > 0
            then round(c.external_buy_clicks::numeric / v.product_views, 4) end as external_ctr
from clicks c
left join views v on v.org_id = c.org_id and v.product_id = c.product_id;

-- purchase_conversion: distinct completed orders per product views AND per session.
-- Guardrail: the denominator in use MUST be labeled in UI — hence two explicit columns.
create or replace view public.v_purchase_conversion
with (security_invoker = true) as
with completions as (
  select org_id,
         count(distinct (properties ->> 'order_id')::uuid) as completed_orders
  from public.events
  where event_name = 'order_complete'
  group by 1
),
views as (
  select org_id,
         count(*) as product_views,
         count(distinct session_id) as viewing_sessions
  from public.events
  where event_name = 'product_view'
  group by 1
)
select v.org_id,
       coalesce(c.completed_orders, 0) as completed_orders,
       v.product_views,
       v.viewing_sessions,
       case when v.product_views > 0
            then round(coalesce(c.completed_orders, 0)::numeric / v.product_views, 4) end as conversion_per_product_view,
       case when v.viewing_sessions > 0
            then round(coalesce(c.completed_orders, 0)::numeric / v.viewing_sessions, 4) end as conversion_per_session
from views v
left join completions c on c.org_id = v.org_id;

-- sell_through: paid/fulfilled drop items / items offered, per drop.
-- Only products offered in a drop count; research-observed listings never do.
create or replace view public.v_sell_through
with (security_invoker = true) as
with offered as (
  select d.org_id, di.drop_id, count(*) as items_offered
  from public.drop_items di
  join public.drops d on d.id = di.drop_id
  group by 1, 2
),
sold as (
  select d.org_id, di.drop_id, count(distinct oi.id) as items_sold
  from public.drop_items di
  join public.drops d on d.id = di.drop_id
  join public.order_items oi on oi.product_id = di.product_id
  join public.orders o on o.id = oi.order_id and o.status in ('paid', 'fulfilled')
  group by 1, 2
)
select f.org_id,
       f.drop_id,
       f.items_offered,
       coalesce(s.items_sold, 0) as items_sold,
       case when f.items_offered > 0
            then round(coalesce(s.items_sold, 0)::numeric / f.items_offered, 4) end as sell_through
from offered f
left join sold s on s.org_id = f.org_id and s.drop_id = f.drop_id;

-- time_to_sale: MEDIAN (percentile_cont 0.5) of paid_at - published_at,
-- per drop × category. Products in multiple drops attribute to each membership.
create or replace view public.v_time_to_sale
with (security_invoker = true) as
select d.org_id,
       di.drop_id,
       p.category_id,
       percentile_cont(0.5) within group (order by (o.paid_at - p.published_at)) as median_time_to_sale,
       count(*) as sample_size
from public.orders o
join public.order_items oi on oi.order_id = o.id
join public.products p on p.id = oi.product_id
join public.drop_items di on di.product_id = p.id
join public.drops d on d.id = di.drop_id
where o.status in ('paid', 'fulfilled')
  and o.paid_at is not null
  and p.published_at is not null
group by 1, 2, 3;

-- gmv: sum(unit_price × quantity) for completed orders, per day × drop.
-- Topline only; not profit (guardrail).
create or replace view public.v_gmv
with (security_invoker = true) as
select o.org_id,
       o.paid_at::date as period_day,
       di.drop_id,
       sum(oi.unit_price_sgd * oi.quantity) as gmv_sgd,
       count(distinct o.id) as order_count
from public.orders o
join public.order_items oi on oi.order_id = o.id
left join public.drop_items di on di.product_id = oi.product_id
where o.status in ('paid', 'fulfilled')
  and o.paid_at is not null
group by 1, 2, 3;

-- fitarchive_contribution: sum of settlement contribution per period × drop.
-- Settlement math is canonical (DATA_MODEL.md §6); NEVER label "net profit".
-- org_id is taken from the seller row (settlements carry no org_id per §2).
create or replace view public.v_fitarchive_contribution
with (security_invoker = true) as
select st.org_id,
       st.period_start,
       st.period_end,
       dd.drop_id,
       count(*) as settlement_count,
       sum(st.gross_sale_sgd) as gross_sale_sgd,
       sum(st.platform_fees_sgd) as platform_fees_sgd,
       sum(st.seller_base_sgd) as seller_base_sgd,
       sum(st.fitarchive_gross_sgd) as fitarchive_gross_sgd,
       sum(st.fitarchive_contribution_sgd) as fitarchive_contribution_sgd
from (
  select s.*, p.org_id
  from public.settlements s
  join public.sellers p on p.id = s.seller_id
) st
left join lateral (
  select di.drop_id
  from public.order_items oi
  join public.drop_items di on di.product_id = oi.product_id
  where oi.order_id = st.order_id
  limit 1
) dd on true
group by 1, 2, 3, 4;

-- campaign_ctr: clicks per tracked link. Impressions are not instrumented, so
-- ctr stays NULL (guardrail: never invent a rate — show clicks only).
create or replace view public.v_campaign_ctr
with (security_invoker = true) as
select c.org_id,
       tl.id as tracked_link_id,
       tl.campaign_id,
       tl.channel,
       count(e.id) as clicks,
       null::int as impressions,
       null::numeric as ctr
from public.tracked_links tl
join public.campaigns c on c.id = tl.campaign_id
left join public.events e
  on e.org_id = c.org_id
 and e.event_name = 'campaign_link_click'
 and e.properties ->> 'tracked_link_id' = tl.id::text
group by 1, 2, 3, 4;

-- style_feedback_success: nailed_it / sessions with any feedback, per mode.
-- Tiny samples labeled (guardrail).
create or replace view public.v_style_feedback_success
with (security_invoker = true) as
select ss.org_id,
       ss.mode,
       count(distinct ss.id) as sessions_with_feedback,
       count(*) filter (where sf.label = 'nailed_it') as nailed_it,
       count(*) as feedback_count,
       case when count(*) > 0
            then round(count(*) filter (where sf.label = 'nailed_it')::numeric / count(*), 4) end as success_rate,
       (count(distinct ss.id) < 30) as is_small_sample
from public.style_sessions ss
join public.style_feedback sf on sf.style_session_id = ss.id
group by 1, 2;

-- ---------- data-quality views (§12.3 panel) ----------

-- Events missing required properties per the §1 dictionary.
create or replace view public.v_dq_missing_properties
with (security_invoker = true) as
select org_id, id as event_id, event_name, occurred_at, 'product_id' as missing_property
from public.events
where event_name in ('product_impression', 'product_view', 'product_save', 'inquiry_start', 'external_buy_click')
  and nullif(properties ->> 'product_id', '') is null
union all
select org_id, id, event_name, occurred_at, 'drop_id'
from public.events
where event_name = 'drop_view' and nullif(properties ->> 'drop_id', '') is null
union all
select org_id, id, event_name, occurred_at, 'position'
from public.events
where event_name = 'product_impression' and nullif(properties ->> 'position', '') is null
union all
select org_id, id, event_name, occurred_at, 'order_id'
from public.events
where event_name in ('checkout_start', 'order_complete') and nullif(properties ->> 'order_id', '') is null
union all
select org_id, id, event_name, occurred_at, 'revenue_sgd'
from public.events
where event_name = 'order_complete' and nullif(properties ->> 'revenue_sgd', '') is null
union all
select org_id, id, event_name, occurred_at, 'tracked_link_id'
from public.events
where event_name = 'campaign_link_click' and nullif(properties ->> 'tracked_link_id', '') is null
union all
select org_id, id, event_name, occurred_at, 'route'
from public.events
where event_name = 'page_view' and nullif(properties ->> 'route', '') is null
union all
select org_id, id, event_name, occurred_at, 'style_session_id'
from public.events
where event_name in ('style_result_generated', 'style_feedback') and nullif(properties ->> 'style_session_id', '') is null
union all
select org_id, id, event_name, occurred_at, 'query'
from public.events
where event_name = 'search_submit' and nullif(properties ->> 'query', '') is null;

-- Source listings sharing a normalized URL (should be empty by construction;
-- unique index in 0005 enforces it — this view documents/audits the invariant).
create or replace view public.v_dq_duplicate_sources
with (security_invoker = true) as
select org_id, normalized_url, count(*) as listing_count, array_agg(id) as listing_ids
from public.source_listings
where normalized_url is not null
group by 1, 2
having count(*) > 1;

-- Permissions past expiry still linked to published products (§12.3).
create or replace view public.v_dq_stale_permissions
with (security_invoker = true) as
select pe.id as permission_id,
       pe.seller_id,
       pe.product_id,
       pe.scope,
       pe.state,
       pe.expires_at,
       p.sku,
       p.slug as product_slug
from public.permissions pe
join public.products p on p.id = pe.product_id
where pe.expires_at is not null
  and pe.expires_at < now()
  and pe.revoked_at is null
  and pe.state <> 'expired_revoked'
  and p.published_at is not null;

-- ---------- metric_definitions registry (one row per canonical metric) ----------
insert into public.metric_definitions (key, name, formula, denominator, guardrail, sql_view) values
  ('product_view_rate', 'Product view rate',
   'count(product_view events) / count(product_impression events), grouped by product × drop × period',
   'product_impression events',
   'Use the unique-session version (unique_session_view_rate) as the secondary metric.',
   'v_product_view_rate'),
  ('save_rate', 'Save rate',
   'count(distinct coalesce(profile_id::text, session_id::text)) with product_save / count(product_view events), per product',
   'product_view events',
   'Identity basis (user vs session) must be stated on the chart; exposed as identity_basis column.',
   'v_save_rate'),
  ('inquiry_rate', 'Inquiry rate',
   'count(inquiry_start events) / count(product_view events), per product × drop',
   'product_view events',
   'Primary conversion proxy when transactions happen off-platform.',
   'v_inquiry_rate'),
  ('external_ctr', 'External buy CTR',
   'count(external_buy_click events) / count(product_view events), per product, segmented by destination',
   'product_view events',
   'Track destination explicitly (destination column).',
   'v_external_ctr'),
  ('purchase_conversion', 'Purchase conversion',
   'count(distinct order_id from order_complete) / count(product_view) OR / count(distinct session_id)',
   'product_view events or distinct sessions (two explicit columns)',
   'Denominator MUST be labeled in UI (conversion_per_product_view vs conversion_per_session).',
   'v_purchase_conversion'),
  ('sell_through', 'Sell-through',
   'count(order_items joined to orders status in (paid, fulfilled)) / count(drop_items in drop), per drop',
   'drop_items offered in the drop',
   'Only counts products offered in a drop; never research-observed listings.',
   'v_sell_through'),
  ('time_to_sale', 'Time to sale (median)',
   'percentile_cont(0.5) within group (order by orders.paid_at - products.published_at), per drop × category',
   'paid/fulfilled order items in drop',
   'Median, not mean.',
   'v_time_to_sale'),
  ('gmv', 'GMV',
   'sum(order_items.unit_price_sgd * quantity) for paid/fulfilled orders, per period × drop',
   'paid/fulfilled order items',
   'Topline only; not profit.',
   'v_gmv'),
  ('fitarchive_contribution', 'FitArchive contribution',
   'sum(settlements.fitarchive_contribution_sgd) per period × drop (settlement math: DATA_MODEL.md §6)',
   'settled sales',
   'Never label "net profit"; overhead, labor, returns and unsold inventory are excluded unless stated.',
   'v_fitarchive_contribution'),
  ('campaign_ctr', 'Campaign CTR',
   'count(campaign_link_click per tracked_link_id) / impressions, per tracked link',
   'link impressions',
   'If impressions are unavailable, show clicks only — do NOT invent a rate (ctr stays NULL).',
   'v_campaign_ctr'),
  ('style_feedback_success', 'Style feedback success',
   'count(style_feedback label=''nailed_it'') / count(style_sessions with any feedback), segmented by mode',
   'style sessions with any feedback',
   'Segment by mode; tiny samples labeled (is_small_sample when n < 30).',
   'v_style_feedback_success')
on conflict (key) do nothing;
