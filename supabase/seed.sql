begin;

-- supabase/seed.sql — FitArchive deterministic demo seed (Build Bible §23.4/§23.5).
--
-- ⚠ SYNTHETIC DEMO DATA. Every person, seller, listing, order and metric in this
-- file is fictional and generated for the benchmark; user-visible surfaces must
-- keep the "synthetic demo" label (A20).
--
-- Determinism: every uuid, timestamp and amount below is fixed. No volatile
-- clock or random functions appear anywhere in this file — re-running the seed always
-- reproduces the identical dataset (see scripts/seed-reset.md).
--
-- Timeline (Asia/Singapore): research capture Jun–Jul 2026 → Drop #001 published
-- 2026-08-15 → events/orders through 2026-09-20 → Drop #002 drafted 2026-09-22.
-- Narrative: cropped/boxy outerwear in the SGD 40–90 mid-price band outperformed
-- (FA-001/002/003/006/007 sold within ~10 days); oversized/long and premium-price
-- pieces (FA-004, FA-005, FA-012) lagged → Drop #002 doubles down on the winners.




-- Demo auth users (magic-link sign-in; password intentionally empty — A1).
-- profiles rows are created by the handle_new_user trigger (0002).
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'owner@fitarchive.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Ada Sim (Owner)"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'mei@thriftwithmei.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Mei Tan"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'kenzo@archive-dad.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Kenzo Yap"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'rina@kstylefinds.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Rina Choi"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'liya@studio-liya.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Liya Rahman"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'style.user@fitarchive.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"June Ong"}'),
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'buyer@fitarchive.demo', '', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '2026-06-01T12:00:00+08:00', '{"provider":"email","providers":["email"]}', '{"display_name":"Daryl Lim"}')
on conflict (id) do nothing;


update public.profiles set role = 'owner' where id = 'a0000000-0000-4000-8000-000000000001';
update public.profiles set role = 'seller' where id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000005');
-- shoppers keep the default role.


-- ---- sellers & agreements (§10.1) ----

insert into public.sellers (id, org_id, user_id, handle, display_name, notes_private, status, created_at, updated_at)
values
  ('b0000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000002', 'thriftwithmei', 'Mei Tan', 'Reliable; ships within 2 days. Prefers IG DM.', 'active', '2026-07-01T10:01:00+08:00', '2026-07-01T10:01:00+08:00'),
  ('b0000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000003', 'archive_dad', 'Kenzo Yap', 'Slow replies on weekends; excellent menswear eye.', 'active', '2026-07-01T10:02:00+08:00', '2026-07-01T10:02:00+08:00'),
  ('b0000000-0000-4000-8000-000000000003', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000004', 'kstylefinds', 'Rina Choi', 'Referral-only; never holds stock for us.', 'active', '2026-07-01T10:03:00+08:00', '2026-07-01T10:03:00+08:00'),
  ('b0000000-0000-4000-8000-000000000004', (select id from public.organizations where slug = 'fitarchive'), 'a0000000-0000-4000-8000-000000000005', 'studio.liya', 'Liya Rahman', 'Content collaborator; leather specialist.', 'active', '2026-07-01T10:04:00+08:00', '2026-07-01T10:04:00+08:00')
on conflict (org_id, handle) do nothing;

insert into public.seller_contacts (id, seller_id, channel, value, is_preferred, created_at, updated_at)
values
  ('b2000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'ig', '@thriftwithmei', true, '2026-07-01T10:05:00+08:00', '2026-07-01T10:05:00+08:00'),
  ('b2000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'carousell', 'carousell.sg/thriftwithmei', false, '2026-07-01T10:05:00+08:00', '2026-07-01T10:05:00+08:00'),
  ('b2000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'carousell', 'carousell.sg/archive_dad', true, '2026-07-01T10:06:00+08:00', '2026-07-01T10:06:00+08:00'),
  ('b2000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000003', 'ig', '@kstylefinds', true, '2026-07-01T10:07:00+08:00', '2026-07-01T10:07:00+08:00'),
  ('b2000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000004', 'email', 'liya@studio-liya.demo', true, '2026-07-01T10:08:00+08:00', '2026-07-01T10:08:00+08:00');

insert into public.agreements (id, seller_id, type, seller_share_pct, seller_fixed_amount_sgd, fulfillment_responsibility, payout_reference, return_terms, starts_at, ends_at, status, created_at, updated_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'consignment', 60.0, null, 'seller ships; FitArchive handles buyer comms', 'paynow-mei', '7-day return, FitArchive covers return shipping', '2026-07-01T12:00:00+08:00', null, 'active', '2026-07-01T09:01:00+08:00', '2026-07-01T09:01:00+08:00'),
  ('b1000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000002', 'consignment', 55.0, null, 'FitArchive fulfils from studio stock', 'paynow-kenzo', 'final sale unless misdescribed', '2026-07-01T12:00:00+08:00', null, 'active', '2026-07-01T09:02:00+08:00', '2026-07-01T09:02:00+08:00'),
  ('b1000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003', 'referral', 15.0, null, 'seller fulfils directly on their own platform', null, 'seller''s own platform terms apply', '2026-07-01T12:00:00+08:00', null, 'active', '2026-07-01T09:03:00+08:00', '2026-07-01T09:03:00+08:00'),
  ('b1000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000004', 'content_collaboration', null, 0.0, 'borrowed pieces returned after shoot', null, 'not for sale; content use only', '2026-07-01T12:00:00+08:00', null, 'active', '2026-07-01T09:04:00+08:00', '2026-07-01T09:04:00+08:00');

commit;
