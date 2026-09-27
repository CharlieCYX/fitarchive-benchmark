# Seed reset — deterministic demo state

The demo dataset is **deterministic**: `supabase/seed.sql` contains no volatile
clock or random functions; every uuid, timestamp and amount is fixed. Resetting
always reproduces the identical dataset (§19.1 "one-command seed reset").

## Reset to the deterministic state

```bash
# full reset: drop + recreate the database, apply migrations 0001–0018, re-seed
supabase db reset
```

That is the whole path. `supabase db reset` re-runs every migration in
`supabase/migrations/` from zero and then applies `supabase/seed.sql` once.

## If you only want to re-seed an existing database

The seed is insert-only and NOT idempotent (fixed primary keys) — do not run it
twice on the same database. Reset first:

```bash
psql "$DATABASE_URL" -c "truncate table
  audit_log, jobs, system_incidents,
  portfolio_snapshots, portfolio_artifacts, portfolio_projects,
  prototype_tests, prds, product_briefs,
  garment_assets, garment_tests, garment_projects,
  metric_snapshots, experiment_assignments, experiments, insights,
  style_feedback, outfit_items, outfits, style_sessions,
  closet_items, style_reference_attributes, style_references,
  ai_generations, ai_prompt_versions,
  metric_definitions, -- re-seeded by migration 0015
  settlements, refunds_returns, payments, order_items, orders,
  events, sessions,
  collection_items, collections, favorites,
  tracked_links, campaign_posts, campaign_assets, campaigns,
  drop_hypotheses, drop_items, drops,
  permissions, ownership_records, product_assets, product_measurements,
  product_variants, products,
  research_observations, source_listings,
  tag_assignments, tag_aliases,
  agreements, seller_contacts, sellers,
  profiles,
  auth.users
  cascade;"
psql "$DATABASE_URL" -f supabase/migrations/0014_taxonomy_seed.sql   # taxonomy upserts (idempotent)
psql "$DATABASE_URL" -f supabase/migrations/0015_metric_views.sql    # metric_definitions rows (idempotent)
psql "$DATABASE_URL" -f supabase/seed.sql
```

(The truncate list excludes `organizations`, `tags`, `source_platforms` and
`metric_definitions`, which migrations own; profiles are truncated because the
seed re-creates demo auth users and the signup trigger rebuilds profiles.)

## Regenerating seed.sql

```bash
python3 scripts/generate_seed.py   # rewrites supabase/seed.sql, byte-stable
```

Edit the weight tables / entities in the generator, not the generated SQL.

## Verification

`docs/TEST_REPORT.md` records the migration-from-zero + seed + assertion run
(real local Postgres, including RLS smoke probes for anon/seller/shopper).
