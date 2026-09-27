begin;

-- FitArchive deterministic demo seed — part of the [db.seed] sql_paths set
-- (see supabase/seed.sql header + scripts/seed-reset.md). SYNTHETIC DEMO DATA.

-- ---- garment lab: one documented case (§9.4) ----

insert into public.garment_projects (id, org_id, title, problem_statement, problem_kind, product_id, before_notes, status, created_at, updated_at)
values
  ('70000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'Pocket depth on cropped jackets (SG commute)', 'Cropped jackets end at the waistband; standard pockets are too shallow for a phone + EZ-Link card, so commuters carry a bag they don''t want.', 'pockets', 'c0000000-0000-4000-8000-000000000003', 'FA-003 chest pocket fits card only; side pockets 11cm deep — phone protrudes 4cm. [Synthetic demo data]', 'prototype_tested', '2026-09-08T10:00:00+08:00', '2026-09-18T10:00:00+08:00');

insert into public.garment_tests (id, garment_project_id, kind, tester_label, consent_obtained, context, feedback, discrepancies_vs_simulation, tested_at, created_at, updated_at)
values
  ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'clo_simulation', null, false, 'CLO 3.12 drape simulation, 16cm angled welt pocket.', 'Simulation shows no drag at hem; phone sits clear of crop line.', null, '2026-09-12T15:00:00+08:00', '2026-09-12T15:00:00+08:00', '2026-09-12T15:00:00+08:00'),
  ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'wear_test', 'tester-a', true, 'Half-day SG commute (MRT + 20min walk), 32°C.', 'Phone secure; card access easy. Pocket bag warm against hip after 30min.', 'Simulation did not predict pocket-bag heat build-up — recorded as simulation gap.', '2026-09-16T09:00:00+08:00', '2026-09-17T10:00:00+08:00', '2026-09-17T10:00:00+08:00');

insert into public.garment_assets (id, garment_project_id, kind, asset_path, version, caption, ai_generation_id, created_at, updated_at)
values
  ('72000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 'flat', 'private-assets/garment/pocket-flat-v1.svg', 1, 'Technical flat: intended 16cm angled welt placement (shows pattern intent, not final construction).', null, '2026-09-11T10:00:00+08:00', '2026-09-11T10:00:00+08:00'),
  ('72000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', 'render', 'private-assets/garment/pocket-clo-render-v1.png', 1, 'CLO render: intended to show phone clearance vs crop line; simulated drape only, not physical evidence.', '13000000-0000-4000-8000-000000000004', '2026-09-12T15:05:00+08:00', '2026-09-12T15:05:00+08:00'),
  ('72000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000001', 'before_photo', 'private-assets/garment/fa-003-before-pocket.jpg', 1, 'Before-state evidence: stock pocket depth on FA-003 (11cm).', null, '2026-09-08T10:30:00+08:00', '2026-09-08T10:30:00+08:00');

-- ---- product lab: one brief → PRD → prototype test (§9.5) ----

insert into public.product_briefs (id, org_id, title, problem, evidence, current_workaround, target_outcome, status, created_at, updated_at)
values
  ('73000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'Size confidence for secondhand PDPs', 'Shoppers can''t judge fit from secondhand listings; returns risk kills conversion.', 'Drop #001: 11 inquiry_start events, 4 asked about measurements; 2 abandoned checkouts.', 'Shoppers DM the seller and wait; most never come back.', 'PDP shows measured garment dims vs shopper''s closet item dims.', 'prv_prototyped', '2026-09-02T10:00:00+08:00', '2026-09-18T10:00:00+08:00');

insert into public.prds (id, product_brief_id, competitor_matrix, user_stories, functional_requirements, nonfunctional_requirements, mvp_scope, deferred_features, success_metrics, created_at, updated_at)
values
  ('74000000-0000-4000-8000-000000000001', '73000000-0000-4000-8000-000000000001', '{"carousell":"no measurements","vestiaire":"flat dims only","ssqrd":"n/a"}', '["As a shopper I can compare pit-to-pit against my own jacket"]', '["PDP measurement table","closet-item comparison selector"]', '["LCP < 2.5s on PDP","all data from product_measurements"]', 'Measurement table + one closet comparison.', 'Fit prediction, size recommendations, AR.', '["inquiry_rate +10% on measured PDPs","fewer than 1 fit-question per 5 inquiries"]', '2026-09-03T10:00:00+08:00', '2026-09-03T10:00:00+08:00');

insert into public.prototype_tests (id, prd_id, prototype_url, tester_label, observation, confusion_notes, tested_at, created_at, updated_at)
values
  ('75000000-0000-4000-8000-000000000001', '74000000-0000-4000-8000-000000000001', 'https://figma.example/fitarchive/size-confidence-v1', 'tester-b', 'Found the comparison in <10s; trusted cm over S/M/L.', 'Expected ''my size'' language; confused by raw cm until closet comparison selected.', '2026-09-17T14:00:00+08:00', '2026-09-17T14:00:00+08:00', '2026-09-17T14:00:00+08:00');

-- ---- Drop #002 draft experiments (§12.5) ----

insert into public.experiments (id, org_id, name, hypothesis, primary_metric, guardrail_metrics, unit_of_assignment, variant_a, variant_b, start_at, end_at, sample_target_or_rationale, confounders_notes, status, conclusion, conclusion_strength, created_at, updated_at)
values
  ('76000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'Price-ladder shift toward entry', 'More ≤SGD 45 entry items lift save_rate vs Drop #001 ladder.', 'save_rate', '{"inquiry_rate"}', 'drop', '{"entry_items":3,"core_items":7,"hero_items":2}', '{"entry_items":6,"core_items":6,"hero_items":2}', null, null, 'Two drops minimum (n≈12 items each); directional at best.', 'Seasonal shift Sep–Oct; IG algorithm variance between drops.', 'draft', null, null, '2026-09-22T10:00:00+08:00', '2026-09-22T10:00:00+08:00'),
  ('76000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'Photography style: flat vs on-body', 'On-body photography raises product_view→inquiry_rate for outerwear.', 'inquiry_rate', '{"save_rate"}', 'product', '{"photo_style":"flat"}', '{"photo_style":"on_body"}', null, null, 'Matched subset of 6 similar jackets; run 2 weeks.', 'Photographer variance; item desirability confound.', 'draft', null, null, '2026-09-22T10:05:00+08:00', '2026-09-22T10:05:00+08:00'),
  -- Remaining §12.5 drafts (Phase 5): collection framing, hero concentration, external discovery route.
  ('76000000-0000-4000-8000-000000000003', (select id from public.organizations where slug = 'fitarchive'), 'Collection framing: generic vs sharper persona story', 'A sharper persona story ("SG aircon layering") raises inquiry_rate vs the generic archive framing. [Synthetic demo data]', 'inquiry_rate', '{"save_rate"}', 'campaign', '{"framing":"generic_archive"}', '{"framing":"persona_aircon_layering"}', null, null, 'Two campaign pushes of similar reach; read clicks and downstream inquiry_rate together.', 'Reach differs by platform algorithm; post times differ; not a clean randomized split.', 'draft', null, null, '2026-09-22T10:10:00+08:00', '2026-09-22T10:10:00+08:00'),
  ('76000000-0000-4000-8000-000000000004', (select id from public.organizations where slug = 'fitarchive'), 'Hero concentration', 'Concentrating hero-tier placement on 2 items (vs 4) raises sell_through on hero items without lowering overall sell_through. [Synthetic demo data]', 'sell_through', '{"gmv"}', 'drop', '{"hero_items":4,"placement":"even"}', '{"hero_items":2,"placement":"positions_1_2"}', null, null, 'One drop cycle; hero-tier n is tiny by construction — inconclusive is a likely honest outcome.', 'Hero item desirability varies independent of placement; price differs across heroes.', 'draft', null, null, '2026-09-22T10:15:00+08:00', '2026-09-22T10:15:00+08:00'),
  ('76000000-0000-4000-8000-000000000005', (select id from public.organizations where slug = 'fitarchive'), 'External discovery route: tracked SSQRD/referral vs direct social', 'Tracked SSQRD/Carousell referral links deliver higher-intent sessions (higher conversion_per_session) than direct social posts. [Synthetic demo data]', 'purchase_conversion', '{"campaign_ctr","product_view_rate"}', 'campaign', '{"route":"direct_social","utm_source":"social platforms"}', '{"route":"referral","utm_source":"ssqrd/carousell"}', null, null, 'Compare conversion_per_session (session denominator) across the two link families after ≥30 sessions each.', 'Self-selection: referral clickers are already shopping. Read as directional at best.', 'draft', null, null, '2026-09-22T10:20:00+08:00', '2026-09-22T10:20:00+08:00');

-- ---- metric snapshots (values match this seed's raw events/orders) ----

-- sell_through=0.75 gmv_drop=491.0 gmv_all=529.0 contribution_total=120.48 median_tts_days=10.85

insert into public.metric_snapshots (id, metric_key, scope, value, period_start, period_end, sample_size, captured_at, created_at, updated_at)
values
  ('77000000-0000-4000-8000-000000000001', 'sell_through', '{"drop_id":"e0000000-0000-4000-8000-000000000001"}', 0.75, '2026-08-15', '2026-09-15', 12, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00'),
  ('77000000-0000-4000-8000-000000000002', 'gmv', '{"drop_id":"e0000000-0000-4000-8000-000000000001"}', 491.0, '2026-08-15', '2026-09-15', 9, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00'),
  ('77000000-0000-4000-8000-000000000003', 'gmv', '{"scope":"org"}', 529.0, '2026-08-15', '2026-09-15', 10, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00'),
  ('77000000-0000-4000-8000-000000000004', 'fitarchive_contribution', '{"scope":"org"}', 120.48, '2026-08-15', '2026-09-15', 5, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00'),
  ('77000000-0000-4000-8000-000000000005', 'time_to_sale', '{"drop_id":"e0000000-0000-4000-8000-000000000001"}', 10.85, '2026-08-15', '2026-09-15', 9, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00'),
  ('77000000-0000-4000-8000-000000000006', 'style_feedback_success', '{"scope":"org"}', 0.6667, '2026-09-04', '2026-09-20', 3, '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:00:00+08:00');

-- ---- portfolio (ADR-006 frozen snapshots; 1 public, 1 draft) ----

insert into public.portfolio_projects (id, org_id, slug, title, one_line_problem, role_lens, contribution, context_constraints, created_at, updated_at)
values
  ('51000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'drop001-merch-case', 'Drop #001: research-to-sell-through loop', 'Can a tiny secondhand drop be run as a measurable experiment rather than a vibe?', 'merchandising', 'Solo: sourcing, permissioning, pricing, campaign, analytics, settlement.', 'Zero ad spend; SG market; n=12 items; 5-week window. [Synthetic demo data]', '2026-09-22T11:00:00+08:00', '2026-09-22T11:00:00+08:00'),
  ('51000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'garment-pocket-case', 'Garment lab: pocket depth on cropped jackets', 'Cropped silhouettes break pocket utility; can evidence-driven redesign fix it?', 'garment', 'Problem framing, simulation, wear test, discrepancy analysis.', 'One prototype; one consented tester. [Synthetic demo data]', '2026-09-23T11:00:00+08:00', '2026-09-23T11:00:00+08:00');

insert into public.portfolio_artifacts (id, portfolio_project_id, kind, asset_path, url, metric_snapshot_id, caption, sort_order, created_at, updated_at)
values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'metric_snapshot', null, null, '77000000-0000-4000-8000-000000000001', 'Sell-through 0.75 for Drop #001 (9/12 items, paid+fulfilled).', 1, '2026-09-24T09:00:00+08:00', '2026-09-24T09:00:00+08:00'),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'metric_snapshot', null, null, '77000000-0000-4000-8000-000000000002', 'GMV SGD 491.00 for Drop #001 period.', 2, '2026-09-24T09:00:00+08:00', '2026-09-24T09:00:00+08:00'),
  ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000001', 'image', 'public-assets/portfolio/drop001-grid.png', null, null, 'Drop grid with tier annotations. [Synthetic demo placeholder image]', 3, '2026-09-24T09:00:00+08:00', '2026-09-24T09:00:00+08:00'),
  ('52000000-0000-4000-8000-000000000004', '51000000-0000-4000-8000-000000000002', 'image', 'public-assets/portfolio/pocket-render.png', null, null, 'CLO render with intent caption. [Synthetic demo placeholder image]', 1, '2026-09-24T09:05:00+08:00', '2026-09-24T09:05:00+08:00');

insert into public.portfolio_snapshots (id, portfolio_project_id, slug, version, frozen_payload, is_public, frozen_at, published_at, created_at, updated_at)
values
  ('50000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'drop001-merch-case-v1', 1, '{"title":"Drop #001: research-to-sell-through loop","one_line_problem":"Can a tiny secondhand drop be run as a measurable experiment rather than a vibe?","role_lens":"merchandising","contribution":"Solo: sourcing, permissioning, pricing, campaign, analytics, settlement.","context_constraints":"Zero ad spend; SG market; n=12 items; 5-week window.","evidence":"24 research listings → 14 products → 12-item drop → 6 tracked links → first-party events.","decision":"Mid-price cropped/boxy assortment over premium/oversized.","artifacts":["drop grid","tracked-link dashboard","settlement ledger"],"result_metrics":{"sell_through":0.75,"gmv_sgd":491.0,"median_time_to_sale_days":10.85,"sample_size":12,"period":"2026-08-15..2026-09-15"},"what_changed_next":"Drop #002 doubles down on entry band + sharper persona story (draft experiments seeded).","limitations":"Single drop; directional evidence only; no forecast claimed.","links":[],"ko_draft":null,"synthetic_demo_data":true}', true, '2026-09-25T09:00:00+08:00', '2026-09-25T09:30:00+08:00', '2026-09-25T09:00:00+08:00', '2026-09-25T09:30:00+08:00'),
  ('50000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'garment-pocket-case-v1', 1, '{"title":"Garment lab: pocket depth on cropped jackets","role_lens":"garment","status":"draft","synthetic_demo_data":true}', false, '2026-09-25T10:00:00+08:00', null, '2026-09-25T10:00:00+08:00', '2026-09-25T10:00:00+08:00');

-- ---- ops: jobs + launch incident log (§17.2, A14) ----

insert into public.jobs (id, org_id, kind, status, payload, retry_count, last_error, run_at, finished_at, created_at, updated_at)
values
  ('78000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'event_rollup', 'succeeded', '{"metric_keys":["sell_through","gmv"]}', 0, null, '2026-09-21T08:55:00+08:00', '2026-09-21T08:56:00+08:00', '2026-09-21T08:55:00+08:00', '2026-09-21T08:56:00+08:00'),
  ('78000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'seed_verification', 'succeeded', '{"events": 472}', 0, null, '2026-09-21T09:00:00+08:00', '2026-09-21T09:01:00+08:00', '2026-09-21T09:00:00+08:00', '2026-09-21T09:01:00+08:00'),
  ('78000000-0000-4000-8000-000000000003', (select id from public.organizations where slug = 'fitarchive'), 'campaign_post_publish', 'failed', '{"campaign_post":"f3000000-0000-4000-8000-000000000004"}', 1, 'manual channel — no scheduler integration (expected in demo)', '2026-09-28T09:00:00+08:00', '2026-09-28T09:00:00+08:00', '2026-09-28T08:59:00+08:00', '2026-09-28T09:00:00+08:00');

insert into public.system_incidents (id, org_id, severity, title, detail, started_at, resolved_at, annotation_only, created_at, updated_at)
values
  ('79000000-0000-4000-8000-000000000001', (select id from public.organizations where slug = 'fitarchive'), 'info', 'IG reach dip (haze week)', 'Annotation: outdoor content underperformed 2026-09-02..06; overlaid on analytics, no action.', '2026-09-02T00:00:00+08:00', '2026-09-06T23:59:00+08:00', true, '2026-09-07T09:00:00+08:00', '2026-09-07T09:00:00+08:00'),
  ('79000000-0000-4000-8000-000000000002', (select id from public.organizations where slug = 'fitarchive'), 'minor', 'Tracked link FA-TT-001 target typo', 'Link pointed at /products/fa-0066 (404) for 2h; corrected target; 0 clicks affected.', '2026-08-20T14:00:00+08:00', '2026-08-20T16:00:00+08:00', false, '2026-08-20T16:05:00+08:00', '2026-08-20T16:05:00+08:00');

commit;
