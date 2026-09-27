begin;

-- FitArchive deterministic demo seed — part of the [db.seed] sql_paths set
-- (see supabase/seed.sql header + scripts/seed-reset.md). SYNTHETIC DEMO DATA.

-- ---- sessions & first-party events (deterministically generated) ----
-- Sessions and events are expanded from the fixed weight tables below with
-- generate_series: no volatile clock/random functions; re-running the seed always produces
-- the identical dataset. Event uuids are md5-derived (stable), preserving the
-- (org_id, client_event_id) dedupe contract on replay.

insert into public.sessions (id, org_id, profile_id, started_at, user_agent, referrer, anon_id, created_at, updated_at)
select
  ('30000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid,
  (select id from public.organizations where slug = 'fitarchive'),
  case g when 60 then 'a0000000-0000-4000-8000-000000000006'::uuid when 61 then 'a0000000-0000-4000-8000-000000000007'::uuid end,
  timestamptz '2026-08-15 09:30:00+08' + ((g - 1) * interval '511 minutes'),
  case when g % 3 = 0 then 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0) Mobile Safari/604.1'
       else 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) Chrome/140' end,
  case when g % 4 = 0 then 'https://instagram.com/' end,
  case when g not in (60, 61) then 'anon-' || lpad(g::text, 4, '0') end,
  timestamptz '2026-08-15 09:30:00+08' + ((g - 1) * interval '511 minutes'),
  timestamptz '2026-08-15 09:30:00+08' + ((g - 1) * interval '511 minutes')
from generate_series(1, 62) g;

-- staging table for event expansion (dropped at end of seed)
create temporary table _seed_ev (
  seq serial primary key,
  event_name text not null,
  props jsonb not null default '{}',
  fixed_occurred timestamptz,
  profile_key text,
  ext_id uuid
);

-- product_impression / product_view weights (support the narrative:
-- cropped/boxy + mid-price FA-001/002/003/006/007/014 draw the most traffic)
insert into _seed_ev (event_name, props)
select 'product_impression',
       jsonb_build_object('product_id', p.id, 'position', coalesce(di.position, 1))
         || case when di.product_id is not null
                 then jsonb_build_object('drop_id', di.drop_id) else '{}'::jsonb end
from (values ('FA-001', 22), ('FA-002', 16), ('FA-003', 14), ('FA-006', 18), ('FA-007', 15), ('FA-010', 10), ('FA-009', 7), ('FA-008', 7), ('FA-011', 6), ('FA-013', 5), ('FA-004', 4), ('FA-012', 3), ('FA-005', 4), ('FA-014', 8)) w(sku, n)
join public.products p on p.sku = w.sku
left join public.drop_items di on di.product_id = p.id
  and di.drop_id = 'e0000000-0000-4000-8000-000000000001'::uuid
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props)
select 'product_view',
       jsonb_build_object('product_id', p.id, 'source', 'drop_grid')
         || case when di.product_id is not null
                 then jsonb_build_object('drop_id', di.drop_id) else '{}'::jsonb end
from (values ('FA-001', 13), ('FA-002', 9), ('FA-003', 8), ('FA-006', 10), ('FA-007', 8), ('FA-010', 6), ('FA-009', 5), ('FA-008', 4), ('FA-011', 4), ('FA-013', 3), ('FA-004', 4), ('FA-012', 2), ('FA-005', 3), ('FA-014', 6)) w(sku, n)
join public.products p on p.sku = w.sku
left join public.drop_items di on di.product_id = p.id
  and di.drop_id = 'e0000000-0000-4000-8000-000000000001'::uuid
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props)
select 'product_save', jsonb_build_object('product_id', p.id, 'collection_id', null)
from (values ('FA-001', 4), ('FA-006', 3), ('FA-002', 2), ('FA-007', 2), ('FA-014', 3), ('FA-003', 1), ('FA-010', 1)) w(sku, n)
join public.products p on p.sku = w.sku
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props) values
  ('product_unsave', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-010'))),
  ('product_unsave', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-013')));

insert into _seed_ev (event_name, props)
select 'inquiry_start', jsonb_build_object('product_id', p.id, 'method', 'form')
from (values ('FA-001', 2), ('FA-002', 2), ('FA-006', 2), ('FA-007', 1), ('FA-003', 1), ('FA-005', 1), ('FA-012', 1), ('FA-014', 1)) w(sku, n)
join public.products p on p.sku = w.sku
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props)
select 'external_buy_click',
       jsonb_build_object('product_id', p.id, 'destination', w.dest, 'tracked_link_id', tl.id)
from (values ('FA-011', 5, 'carousell', 'FA-CL-001'), ('FA-014', 2, 'ssqrd', 'FA-SQ-001'), ('FA-012', 1, 'carousell', 'FA-CL-001')) w(sku, n, dest, link_code)
join public.products p on p.sku = w.sku
join public.tracked_links tl on tl.code = w.link_code
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props) values
  ('share_click', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-001'), 'channel', 'whatsapp')),
  ('share_click', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-001'), 'channel', 'whatsapp')),
  ('share_click', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-006'), 'channel', 'telegram')),
  ('share_click', jsonb_build_object('product_id', (select id from public.products where sku = 'FA-002'), 'channel', 'copy_link')),
  ('share_click', jsonb_build_object('drop_id', 'e0000000-0000-4000-8000-000000000001'::uuid, 'channel', 'copy_link')),
  ('share_click', jsonb_build_object('drop_id', 'e0000000-0000-4000-8000-000000000001'::uuid, 'channel', 'copy_link'));

insert into _seed_ev (event_name, props)
select 'campaign_link_click', jsonb_build_object('tracked_link_id', tl.id)
from (values ('FA-IG-001', 7), ('FA-IG-002', 4), ('FA-CL-001', 3), ('FA-SQ-001', 5), ('FA-NL-001', 1), ('FA-TT-001', 2)) w(code, n)
join public.tracked_links tl on tl.code = w.code
cross join lateral generate_series(1, w.n) g;

insert into _seed_ev (event_name, props)
select 'page_view',
       jsonb_build_object(
         'route', (array['/','/drops','/drops/drop-001','/products/fa-001','/products/fa-002','/products/fa-003','/products/fa-004','/products/fa-005','/products/fa-006','/products/fa-007','/products/fa-008','/products/fa-009','/products/fa-010'])[1 + (g % 13)],
         'referrer', case when g % 4 = 0 then 'https://instagram.com/' end,
         'campaign', case when g % 4 = 0 then 'drop001_launch' end,
         'utm_source', case when g % 4 = 0 then 'ig' end,
         'utm_medium', case when g % 4 = 0 then 'bio' end,
         'utm_campaign', case when g % 4 = 0 then 'drop001_launch' end,
         'utm_content', null)
from generate_series(1, 90) g;

insert into _seed_ev (event_name, props)
select 'drop_view', jsonb_build_object('drop_id', 'e0000000-0000-4000-8000-000000000001'::uuid)
from generate_series(1, 45) g;

insert into _seed_ev (event_name, props, ext_id)
select 'search_submit',
       jsonb_build_object('query', qy, 'parsed_filters',
         case when g <= 2 then '{"category":"outerwear"}'::jsonb else '{}'::jsonb end,
         'result_count', 5 - (g % 3)),
       (md5('fitarchive-seed-search-' || g))::uuid
from (select qy, row_number() over () as g
       from (values ('cropped jacket'), ('boxy outerwear'), ('linen'), ('y2k'), ('trench')) v(qy)) q;

insert into _seed_ev (event_name, props)
select 'search_result_click',
       jsonb_build_object('query_id', (md5('fitarchive-seed-search-' || w.g))::text,
                          'product_id', p.id, 'position', w.g)
from (values (1, 'FA-001'), (2, 'FA-006'), (3, 'FA-003')) w(g, sku)
join public.products p on p.sku = w.sku;

-- commerce events bound to order timestamps (orders themselves are seeded below;
-- properties are jsonb so no FK ordering issue)
insert into _seed_ev (event_name, props, fixed_occurred, profile_key)
select 'checkout_start', jsonb_build_object('order_id', o.oid), o.paid_at::timestamptz,
       case when o.n % 3 = 0 then 'shopper2' end
from (values (1, '10000000-0000-4000-8000-000000000001', '2026-08-16T14:05:00+08:00', '68.0'), (2, '10000000-0000-4000-8000-000000000002', '2026-08-17T09:40:00+08:00', '60.0'), (3, '10000000-0000-4000-8000-000000000003', '2026-08-19T21:15:00+08:00', '55.0'), (4, '10000000-0000-4000-8000-000000000004', '2026-08-22T11:30:00+08:00', '45.0'), (5, '10000000-0000-4000-8000-000000000005', '2026-08-25T16:20:00+08:00', '42.0'), (6, '10000000-0000-4000-8000-000000000006', '2026-08-28T13:10:00+08:00', '85.0'), (7, '10000000-0000-4000-8000-000000000007', '2026-09-01T10:00:00+08:00', '58.0'), (8, '10000000-0000-4000-8000-000000000008', '2026-09-03T19:45:00+08:00', '50.0'), (9, '10000000-0000-4000-8000-000000000009', '2026-09-06T12:30:00+08:00', '38.0'), (10, '10000000-0000-4000-8000-000000000010', '2026-09-08T15:55:00+08:00', '28.0')) o(n, oid, paid_at, rev)
union all
select 'order_complete', jsonb_build_object('order_id', o.oid, 'revenue_sgd', o.rev), o.paid_at::timestamptz,
       case when o.n % 3 = 0 then 'shopper2' end
from (values (1, '10000000-0000-4000-8000-000000000001', '2026-08-16T14:05:00+08:00', '68.0'), (2, '10000000-0000-4000-8000-000000000002', '2026-08-17T09:40:00+08:00', '60.0'), (3, '10000000-0000-4000-8000-000000000003', '2026-08-19T21:15:00+08:00', '55.0'), (4, '10000000-0000-4000-8000-000000000004', '2026-08-22T11:30:00+08:00', '45.0'), (5, '10000000-0000-4000-8000-000000000005', '2026-08-25T16:20:00+08:00', '42.0'), (6, '10000000-0000-4000-8000-000000000006', '2026-08-28T13:10:00+08:00', '85.0'), (7, '10000000-0000-4000-8000-000000000007', '2026-09-01T10:00:00+08:00', '58.0'), (8, '10000000-0000-4000-8000-000000000008', '2026-09-03T19:45:00+08:00', '50.0'), (9, '10000000-0000-4000-8000-000000000009', '2026-09-06T12:30:00+08:00', '38.0'), (10, '10000000-0000-4000-8000-000000000010', '2026-09-08T15:55:00+08:00', '28.0')) o(n, oid, paid_at, rev)
union all
select 'checkout_start', jsonb_build_object('order_id', '10000000-0000-4000-8000-000000000011'::uuid),
       timestamptz '2026-09-12 20:00:00+08', null
union all
select 'checkout_start', jsonb_build_object('order_id', '10000000-0000-4000-8000-000000000012'::uuid),
       timestamptz '2026-09-13 21:30:00+08', null;

-- style engine events (sessions created below; ids are fixed)
insert into _seed_ev (event_name, props, fixed_occurred, profile_key) values
  ('style_session_start', '{"mode":"build_my_fit"}', timestamptz '2026-09-05 20:00:00+08', 'shopper'),
  ('style_result_generated', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000001'::uuid, 'provider', 'mock', 'model', 'mock-deterministic-v1'), timestamptz '2026-09-05 20:00:30+08', 'shopper'),
  ('style_feedback', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000001'::uuid, 'label', 'nailed_it'), timestamptz '2026-09-05 20:05:00+08', 'shopper'),
  ('style_session_start', '{"mode":"can_this_work"}', timestamptz '2026-09-09 21:15:00+08', 'shopper'),
  ('style_result_generated', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000002'::uuid, 'provider', 'mock', 'model', 'mock-deterministic-v1'), timestamptz '2026-09-09 21:15:30+08', 'shopper'),
  ('style_feedback', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000002'::uuid, 'label', 'nailed_it'), timestamptz '2026-09-09 21:20:00+08', 'shopper'),
  ('style_session_start', '{"mode":"decode_reference"}', timestamptz '2026-09-14 19:40:00+08', 'shopper'),
  ('style_result_generated', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000003'::uuid, 'provider', 'mock', 'model', 'mock-deterministic-v1'), timestamptz '2026-09-14 19:40:30+08', 'shopper'),
  ('style_feedback', jsonb_build_object('style_session_id', '40000000-0000-4000-8000-000000000003'::uuid, 'label', 'too_hot'), timestamptz '2026-09-14 19:45:00+08', 'shopper');

insert into _seed_ev (event_name, props, fixed_occurred, profile_key)
select 'closet_item_add',
       jsonb_build_object('closet_item_id', ('41000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid),
       timestamptz '2026-09-04 18:00:00+08' + ((g - 1) * interval '7 minutes'),
       'shopper'
from generate_series(1, 5) g;

insert into _seed_ev (event_name, props, fixed_occurred)
select 'portfolio_view',
       jsonb_build_object('portfolio_snapshot_id', '50000000-0000-4000-8000-000000000001'::uuid, 'section', sec),
       timestamptz '2026-09-26 10:00:00+08' + (g * interval '3 minutes')
from (select sec, row_number() over () - 1 as g
       from (values ('hero'), ('evidence'), ('metrics'), ('reflection')) v(sec)) s;

-- final insert: deterministic occurred_at (base + 71min*seq + jitter) unless fixed
insert into public.events (id, org_id, event_name, occurred_at, session_id, profile_id,
                           route, referrer, client_event_id, properties, created_at)
select
  coalesce(e.ext_id, (md5('fitarchive-seed-event-' || e.seq))::uuid),
  (select id from public.organizations where slug = 'fitarchive'),
  e.event_name,
  coalesce(e.fixed_occurred,
           timestamptz '2026-08-15 10:00:00+08' + (e.seq * interval '71 minutes')
           + ((e.seq % 5) * interval '19 minutes')),
  ('30000000-0000-4000-8000-' || lpad(
     (case e.profile_key when 'shopper' then 60 when 'shopper2' then 61
                         else (e.seq % 58) + 1 end)::text, 12, '0'))::uuid,
  case e.profile_key when 'shopper' then 'a0000000-0000-4000-8000-000000000006'::uuid
                     when 'shopper2' then 'a0000000-0000-4000-8000-000000000007'::uuid end,
  e.props ->> 'route',
  e.props ->> 'referrer',
  coalesce(e.ext_id, (md5('fitarchive-seed-event-' || e.seq))::uuid),
  e.props || jsonb_build_object('session_id',
     '30000000-0000-4000-8000-' || lpad(
       (case e.profile_key when 'shopper' then 60 when 'shopper2' then 61
                           else (e.seq % 58) + 1 end)::text, 12, '0')),
  coalesce(e.fixed_occurred,
           timestamptz '2026-08-15 10:00:00+08' + (e.seq * interval '71 minutes')
           + ((e.seq % 5) * interval '19 minutes'))
from _seed_ev e;

drop table _seed_ev;

commit;
