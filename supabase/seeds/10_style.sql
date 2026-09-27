begin;

-- FitArchive deterministic demo seed — part of the [db.seed] sql_paths set
-- (see supabase/seed.sql header + scripts/seed-reset.md). SYNTHETIC DEMO DATA.

-- ---- style engine: one shopper with closet, sessions, feedback (§8) ----

insert into public.closet_items (id, profile_id, title, category_id, color, fit_notes, photo_asset_path, wear_frequency, ownership_source, created_at, updated_at)
values
  ('41000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'White ribbed tank', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'category' and t.slug = 'top'), 'white', 'true to size', 'private-assets/closet/june-tank.jpg', 'weekly', 'owned', '2026-09-04T18:00:00+08:00', '2026-09-04T18:00:00+08:00'),
  ('41000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'Black straight jeans', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'category' and t.slug = 'denim'), 'black', 'runs long', 'private-assets/closet/june-jeans.jpg', 'weekly', 'owned', '2026-09-04T18:07:00+08:00', '2026-09-04T18:07:00+08:00'),
  ('41000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 'Grey oversized hoodie', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'category' and t.slug = 'top'), 'grey', 'size up', 'private-assets/closet/june-hoodie.jpg', 'rarely', 'owned', '2026-09-04T18:14:00+08:00', '2026-09-04T18:14:00+08:00'),
  ('41000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000006', 'Navy pleated skirt', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'category' and t.slug = 'skirt'), 'navy', 'waist snug', 'private-assets/closet/june-skirt.jpg', 'monthly', 'owned', '2026-09-04T18:21:00+08:00', '2026-09-04T18:21:00+08:00'),
  ('41000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000006', 'White leather sneakers', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'category' and t.slug = 'footwear'), 'white', null, 'private-assets/closet/june-sneakers.jpg', 'daily', 'owned', '2026-09-04T18:28:00+08:00', '2026-09-04T18:28:00+08:00');

insert into public.style_references (id, profile_id, source, url, asset_path, note, created_at, updated_at)
values
  ('42000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'url', 'https://www.pinterest.example/pin/boxy-layering-01', null, 'Boxy jacket over wide trouser, monochrome. [Synthetic demo data]', '2026-09-05T19:00:00+08:00', '2026-09-05T19:00:00+08:00'),
  ('42000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'upload', null, 'private-assets/references/june-ref-2.jpg', 'K-street cropped blazer look. [Synthetic demo data]', '2026-09-05T19:10:00+08:00', '2026-09-05T19:10:00+08:00');

insert into public.style_reference_attributes (id, style_reference_id, dimension, tag_id, free_value, confidence, source, created_at, updated_at)
values
  ('45000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'silhouette', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'silhouette' and t.slug = 'boxy'), null, 0.85, 'ai_suggestion', '2026-09-05T19:05:00+08:00', '2026-09-05T19:05:00+08:00'),
  ('45000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001', 'palette_role', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'palette_role' and t.slug = 'monochrome'), null, 0.90, 'ai_suggestion', '2026-09-05T19:05:00+08:00', '2026-09-05T19:05:00+08:00'),
  ('45000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002', 'silhouette', (select t.id from public.tags t join public.organizations o on o.id = t.org_id and o.slug = 'fitarchive' where t.dimension = 'silhouette' and t.slug = 'cropped'), null, null, 'human', '2026-09-05T19:12:00+08:00', '2026-09-05T19:12:00+08:00');

insert into public.style_sessions (id, org_id, profile_id, session_id, mode, inputs, result, deterministic, ai_generation_id, created_at, updated_at)
values
  ('40000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000060', 'build_my_fit', '{"occasion":"daily","climate":"hot-humid","budget_sgd":90,"owned_items":["41000000-0000-4000-8000-000000000001","41000000-0000-4000-8000-000000000002"]}', '{"thesis":"Boxy crop over straight leg; linen layer for aircon.","items":[{"product":"c0000000-0000-4000-8000-000000000007","role":"layer"},{"closet":"41000000-0000-4000-8000-000000000001","role":"base"}],"confidence":0.72}', false, '13000000-0000-4000-8000-000000000003', '2026-09-05T20:00:00+08:00', '2026-09-05T20:00:00+08:00'),
  ('40000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000060', 'can_this_work', '{"items":["c0000000-0000-4000-8000-000000000010","41000000-0000-4000-8000-000000000004"],"question":"Cropped cardigan over pleated skirt?"}', '{"verdict":"tension_but_usable","explanation":"Both cropped; add length via inner layer.","repair_moves":["longline tank under cardigan"]}', true, null, '2026-09-09T21:15:00+08:00', '2026-09-09T21:15:00+08:00'),
  ('40000000-0000-4000-8000-000000000003', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000060', 'decode_reference', '{"style_reference":"42000000-0000-4000-8000-000000000001"}', '{"silhouette":"boxy","palette":"monochrome","era":"contemporary","confidence":0.8,"climate_note":"Swap wool for linen in SG."}', true, null, '2026-09-14T19:40:00+08:00', '2026-09-14T19:40:00+08:00');

insert into public.style_feedback (id, style_session_id, label, failure_mode, note, created_by, created_at)
values
  ('46000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'nailed_it', null, 'Exactly my lane.', 'a0000000-0000-4000-8000-000000000006', '2026-09-05T20:05:00+08:00'),
  ('46000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'nailed_it', null, null, 'a0000000-0000-4000-8000-000000000006', '2026-09-09T21:20:00+08:00'),
  ('46000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000003', 'too_hot', 'constraint_miss', 'Wool suggestion wrong for SG; linen swap was right.', 'a0000000-0000-4000-8000-000000000006', '2026-09-14T19:45:00+08:00');

insert into public.outfits (id, profile_id, style_session_id, title, thesis, climate, occasion, is_saved, created_at, updated_at)
values
  ('43000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000001', 'Aircon commute fit', 'Boxy crop over straight leg; linen layer for aircon.', 'hot-humid', 'daily', true, '2026-09-05T20:02:00+08:00', '2026-09-05T20:02:00+08:00');

insert into public.outfit_items (id, outfit_id, product_id, closet_item_id, style_reference_id, placeholder_label, role, created_at, updated_at)
values
  ('47000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', null, null, null, 'layer', '2026-09-05T20:02:00+08:00', '2026-09-05T20:02:00+08:00'),
  ('47000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000001', null, '41000000-0000-4000-8000-000000000001', null, null, 'base', '2026-09-05T20:02:00+08:00', '2026-09-05T20:02:00+08:00'),
  ('47000000-0000-4000-8000-000000000003', '43000000-0000-4000-8000-000000000001', null, '41000000-0000-4000-8000-000000000002', null, null, 'bottom', '2026-09-05T20:02:00+08:00', '2026-09-05T20:02:00+08:00');

insert into public.favorites (id, profile_id, product_id, created_at)
values
  ('48000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000006', '2026-09-06T12:00:00+08:00'),
  ('48000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000014', '2026-09-07T13:00:00+08:00'),
  ('48000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', '2026-09-05T20:10:00+08:00')
on conflict (profile_id, product_id) do nothing;

insert into public.collections (id, profile_id, title, description, is_public, created_at, updated_at)
values
  ('49000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000006', 'SG layering ideas', 'Private board. [Synthetic demo data]', false, '2026-09-06T12:05:00+08:00', '2026-09-06T12:05:00+08:00');

insert into public.collection_items (id, collection_id, product_id, style_reference_id, note, position, created_at, updated_at)
values
  ('4a000000-0000-4000-8000-000000000001', '49000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000007', null, null, 1, '2026-09-06T12:06:00+08:00', '2026-09-06T12:06:00+08:00'),
  ('4a000000-0000-4000-8000-000000000002', '49000000-0000-4000-8000-000000000001', null, '42000000-0000-4000-8000-000000000001', 'Mood anchor', 2, '2026-09-06T12:07:00+08:00', '2026-09-06T12:07:00+08:00');

commit;
