begin;

-- FitArchive deterministic demo seed — part of the [db.seed] sql_paths set
-- (see supabase/seed.sql header + scripts/seed-reset.md). SYNTHETIC DEMO DATA.

insert into public.drop_hypotheses (id, drop_id, statement, expected_outcome, evidence_basis, linked_insight_id, created_at, updated_at)
values
  ('e2000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000001', 'Cropped/boxy outerwear in SGD 40–90 will sell through faster than oversized or >SGD 100 pieces.', '≥50% sell-through of the cropped/boxy mid-band within 4 weeks of launch.', 'Research inbox engagement (Jun–Jul) + SSQRD discovery corroboration.', null, '2026-08-10T09:30:00+08:00', '2026-08-10T09:30:00+08:00'),
  ('e2000000-0000-4000-8000-000000000002', 'e0000000-0000-4000-8000-000000000002', 'More entry-band items (≤SGD 45) + sharper persona story lifts save→inquiry conversion over Drop #001.', 'save_rate +20% relative vs Drop #001 baseline; inquiry_rate non-decreasing (guardrail).', 'Drop #001: mid-band cropped/boxy sold through 5/5 within 10 days; premium pieces unsold.', '11000000-0000-4000-8000-000000000001', '2026-09-22T09:30:00+08:00', '2026-09-22T09:30:00+08:00');

insert into public.campaigns (id, org_id, drop_id, name, brief, status, starts_at, ends_at, created_at, updated_at)
values
  ('f0000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'e0000000-0000-4000-8000-000000000001', 'Drop #001 Launch', 'Launch push: IG bio/story + Carousell listing links. [Synthetic demo data]', 'active', '2026-08-15T09:00:00+08:00', '2026-09-15T23:59:00+08:00', '2026-08-12T09:00:00+08:00', '2026-08-12T09:00:00+08:00'),
  ('f0000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'e0000000-0000-4000-8000-000000000001', 'Mid-Price Edit — SSQRD discovery', 'Evergreen discovery push via SSQRD + newsletter. [Synthetic demo data]', 'active', '2026-09-01T09:00:00+08:00', '2026-10-31T23:59:00+08:00', '2026-08-30T09:00:00+08:00', '2026-08-30T09:00:00+08:00');

insert into public.campaign_assets (id, campaign_id, kind, asset_path, version, approval_status, ai_generation_id, synthetic_disclosed, created_at, updated_at)
values
  ('f2000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'image', 'campaigns/drop001/hero-grid-v1.jpg', 1, 'approved', null, false, '2026-08-13T10:00:00+08:00', '2026-08-13T10:00:00+08:00'),
  ('f2000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'copy', null, 2, 'approved', '13000000-0000-4000-8000-000000000001', false, '2026-08-13T11:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f2000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'copy', null, 1, 'draft', null, false, '2026-08-30T10:00:00+08:00', '2026-08-30T10:00:00+08:00');

insert into public.campaign_posts (id, campaign_id, channel, copy, asset_id, planned_at, published_at, state, created_at, updated_at)
values
  ('f3000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'instagram', 'Drop #001 is live: cropped & boxy, SG-proof. Link in bio. [Synthetic demo data]', 'f2000000-0000-4000-8000-000000000001', '2026-08-15T10:00:00+08:00', '2026-08-15T10:00:00+08:00', 'published', '2026-08-14T09:00:00+08:00', '2026-08-15T10:00:00+08:00'),
  ('f3000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'instagram', 'Story: 3 ways to layer the boxy linen shirt-jacket. [Synthetic demo data]', null, '2026-08-18T19:00:00+08:00', '2026-08-18T19:00:00+08:00', 'published', '2026-08-17T09:00:00+08:00', '2026-08-18T19:00:00+08:00'),
  ('f3000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000002', 'ssqrd', 'Mid-price edit: everything under SGD 90. [Synthetic demo data]', null, '2026-09-01T12:00:00+08:00', '2026-09-01T12:00:00+08:00', 'published', '2026-08-31T09:00:00+08:00', '2026-09-01T12:00:00+08:00'),
  ('f3000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'newsletter', 'September edit teaser. [Synthetic demo data]', null, '2026-09-28T09:00:00+08:00', null, 'planned', '2026-09-20T09:00:00+08:00', '2026-09-20T09:00:00+08:00');

insert into public.tracked_links (id, campaign_id, campaign_post_id, target_url, utm_source, utm_medium, utm_campaign, utm_content, channel, code, created_at, updated_at)
values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000001', 'https://fitarchive.demo/drops/drop-001', 'ig', 'bio', 'drop001_launch', 'hero', 'instagram', 'FA-IG-001', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000002', 'https://fitarchive.demo/drops/drop-001', 'ig', 'story', 'drop001_launch', 'grid', 'instagram', 'FA-IG-002', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000001', null, 'https://fitarchive.demo/products/fa-001', 'carousell', 'listing', 'drop001_launch', null, 'carousell', 'FA-CL-001', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f1000000-0000-4000-8000-000000000004', 'f0000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000003', 'https://fitarchive.demo/drops/drop-001?band=mid', 'ssqrd', 'referral', 'midprice_edit', null, 'ssqrd', 'FA-SQ-001', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000002', null, 'https://fitarchive.demo/drops/drop-001', 'email', 'newsletter', 'midprice_edit', null, 'newsletter', 'FA-NL-001', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00'),
  ('f1000000-0000-4000-8000-000000000006', 'f0000000-0000-4000-8000-000000000001', null, 'https://fitarchive.demo/products/fa-006', 'tiktok', 'video', 'drop001_launch', 'tryon', 'tiktok', 'FA-TT-001', '2026-08-14T09:00:00+08:00', '2026-08-14T09:00:00+08:00')
on conflict (code) do nothing;

commit;
