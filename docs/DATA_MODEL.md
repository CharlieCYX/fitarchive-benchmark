# FitArchive Benchmark — Data Model

Status: Phase 0 contract. Every table from Build Bible §11.1 is listed here with key
columns, FKs and RLS rules. Names are binding across all docs and code.

Conventions (ADR-002):
- `id uuid pk default gen_random_uuid()`; `org_id uuid not null references organizations(id)` on every org-scoped table.
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` on all entity tables (omitted below for brevity).
- Money: `numeric(12,2)`, SGD, suffixed `_sgd`.
- `references` → renamed `style_references`; `reference_attributes` → `style_reference_attributes` (ADR-005; `references` is a SQL reserved word).

## 1. Enums (created in migration 0001)

| Enum | Values | Source |
|---|---|---|
| `app_role` | `owner, seller, shopper, stylist, analyst, viewer` | §5 |
| `permission_state` | `observed_only, contacted, permission_referral, permission_consignment, owned, borrowed_for_content, prototype_permission, expired_revoked` | §5.2 |
| `agreement_type` | `owned, consignment, referral, content_collaboration` | §10.1 |
| `condition_grade` | `new_unworn, excellent, good, fair, project_repair` | §10.5 |
| `availability_status` | `draft, available, reserved, sold, withdrawn` | §11.2 |
| `drop_item_tier` | `entry, core, hero` | §7.5 |
| `drop_status` | `planning, ready, scheduled, published, paused, closed` | §7.7 |
| `order_mode` | `demo, external_manual` | §10.3 |
| `order_status` | `pending, paid, fulfilled, cancelled, refunded` | §10.3 |
| `payment_status` | `initiated, authorized, captured, failed, refunded, simulated` | §10.3 |
| `insight_type` | `observation, hypothesis, experiment, validated_result, forecast` | §9.2 |
| `conclusion_strength` | `inconclusive, directional, repeated_evidence` | §12.4 |
| `experiment_status` | `draft, running, paused, concluded, abandoned` | §12.4 |
| `experiment_unit` | `session, product, campaign, drop` | §12.4 |
| `style_mode` | `build_my_fit, can_this_work, decode_reference` | §8.3–8.5 |
| `style_feedback_label` | `nailed_it, too_costume, too_hot, wrong_silhouette, wrong_budget, other` | §8.3 |
| `style_failure_mode` | `constraint_miss, hallucinated_inventory, cosplay_overfit, contradiction_blindness, unsupported_certainty, preference_miss` | §8.8 |
| `tag_source` | `human, seller_provided, ai_suggestion, imported_metadata, rule` | §11.4 |
| `ai_generation_status` | `draft, accepted, rejected, superseded` | §13.3 |
| `job_status` | `queued, running, succeeded, failed, cancelled` | §17.2 |
| `taxonomy_dimension` | `category, silhouette, proportion, material, palette_role, energy, era, aesthetic, climate, use` | §11.3 |

## 2. Schema (§11.1 — all 59 tables)

RLS shorthand (policies in migration 0013):
`owner` = full access · `self` = row owner (`profile_id`/`user_id` match) ·
`seller-self` = rows whose `seller_id` links to the caller's seller record ·
`public` = anon/authenticated read of published rows only · `service` = service role only (no client policy).

### Identity & org
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `organizations` | `id, name text, slug text unique` | — | owner |
| `profiles` | `id references auth.users, org_id, role app_role not null default 'shopper', display_name text, locale text default 'en-SG', consent jsonb default '{}'` | organizations | self read/update; owner read all; service |

### Sellers & permissions
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `sellers` | `id, org_id, handle text, display_name text, notes_private text, status text default 'active'` | profiles(`user_id` nullable — portal login) | owner; seller-self read own |
| `seller_contacts` | `id, seller_id, channel text (carousell/ig/email/phone), value text, is_preferred bool` | sellers | owner; seller-self read |
| `agreements` | `id, seller_id, type agreement_type, seller_share_pct numeric(5,2), seller_fixed_amount_sgd numeric(12,2), fulfillment_responsibility text, payout_reference text, return_terms text, starts_at, ends_at, status text` | sellers | owner; seller-self read |
| `permissions` | `id, seller_id, product_id nullable, scope text (representation/media/alteration), state permission_state, granted_at, expires_at, revoked_at, evidence_asset_id nullable` | sellers, products, product_assets | owner; seller-self read |
| `settlements` | `id, seller_id, agreement_id, order_id nullable, period_start date, period_end date, gross_sale_sgd, platform_fees_sgd, seller_base_sgd, fitarchive_gross_sgd, fitarchive_contribution_sgd, status text (pending/paid), paid_at` | sellers, agreements, orders | owner; seller-self read |

### Research
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `source_platforms` | `id, name text unique (Carousell, Instagram, SSQRD, manual, physical_market), kind text` | — | owner write; public read |
| `source_listings` | `id, source_platform_id, source_url text, normalized_url text, captured_at timestamptz, seller_handle text, seller_id nullable, title, brand, asking_price_sgd, condition_note text, visible_engagement int, listing_age_days int, permission_state permission_state default 'observed_only', drop_candidate bool default false, is_active bool default true, notes text` | source_platforms, sellers; unique(org_id, normalized_url) for duplicate detection §7.2 | owner only |
| `research_observations` | `id, source_listing_id, observed_at, observer_id, note text, confidence numeric(3,2)` | source_listings, profiles | owner only |

### Catalog
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `products` | `id, org_id, slug text unique, sku text unique, title text, brand text, category_id (tag), condition_grade condition_grade, defect_notes text, description_public text, notes_private text, public_price_sgd numeric(12,2), cost_basis_sgd numeric(12,2), seller_id nullable, availability availability_status default 'draft', synthetic_media_present bool default false, published_at timestamptz` | tags(category_id), sellers | public read where `published_at is not null`; owner full; seller-self read |
| `product_variants` | `id, product_id, label text (size/color), sku_suffix text, availability availability_status` | products | as products |
| `product_measurements` | `id, product_id, name text, value numeric(8,2), unit text, method text` | products | as products |
| `product_assets` | `id, org_id, product_id nullable, bucket text, path text, checksum text, file_type text, privacy text (public/private), alt_text text, provenance text (operator/seller/ai_synthetic), synthetic bool default false, rights_note text` | products | public read public assets of published products; owner full; seller-self read own items' assets |
| `ownership_records` | `id, product_id, state permission_state, effective_from, effective_to nullable, note text` | products (latest row = current state; §11.2 "derived") | owner; seller-self read |

### Taxonomy
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `tags` | `id, org_id, dimension taxonomy_dimension, slug text, label text, version int default 1, is_active bool default true; unique(org_id, dimension, slug, version)` | — | public read active; owner write |
| `tag_aliases` | `id, tag_id, alias text unique` | tags | owner write; public read |
| `tag_assignments` | `id, tag_id, entity_type text, entity_id uuid, source tag_source, confidence numeric(3,2), accepted bool default true, created_by nullable` | tags; polymorphic (entity_type+entity_id) | follows target entity; AI-suggested consequential tags `accepted=false` until human review (§11.4) |

### Drops & campaigns
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `drops` | `id, org_id, slug text unique, name text (e.g. "Drop #001"), concept text, story text, hypothesis_summary text, status drop_status default 'planning', target_size_min int, target_size_max int, launch_at, published_at, closed_at, cloned_from_id nullable` | drops(cloned_from_id) | public read when published; owner full |
| `drop_items` | `id, drop_id, product_id, position int, tier drop_item_tier, price_override_sgd numeric(12,2) nullable; unique(drop_id, product_id)` | drops, products | as drops |
| `drop_hypotheses` | `id, drop_id, statement text, expected_outcome text, evidence_basis text, linked_insight_id nullable` | drops, insights | owner; analyst read |
| `campaigns` | `id, org_id, drop_id nullable, name, brief text, status text, starts_at, ends_at` | drops | owner; public read published posts only (via campaign_posts) |
| `campaign_assets` | `id, campaign_id, kind text (image/copy/post), asset_path text, version int, approval_status text (draft/approved/rejected), ai_generation_id nullable, synthetic_disclosed bool default false` | campaigns, ai_generations | owner; stylist assigned read |
| `campaign_posts` | `id, campaign_id, channel text, copy text, asset_id nullable, planned_at, published_at, state text` | campaigns, campaign_assets | public read where published; owner full |
| `tracked_links` | `id, campaign_id, campaign_post_id nullable, target_url text, utm_source, utm_medium, utm_campaign, utm_content, channel text, code text unique` | campaigns, campaign_posts | owner; click events public-write via event service |

### Events & shopper data
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `sessions` | `id, org_id, profile_id nullable, started_at, user_agent text, referrer text, anon_id text` | profiles | self read; service write; owner read |
| `events` | `id, org_id, event_name text (dictionary EVENTS_AND_METRICS.md §1), occurred_at timestamptz default now(), session_id, profile_id nullable, route text, referrer text, client_event_id uuid, properties jsonb default '{}'` ; `unique(org_id, client_event_id)` for replay dedupe (§19.1) | sessions, profiles | service/owner write via event service only; owner read; no public read |
| `favorites` | `id, profile_id, product_id, created_at; unique(profile_id, product_id)` | profiles, products | self |
| `collections` | `id, profile_id nullable (null = editorial/operator), title, description, is_public bool default false` | profiles | self; public read if is_public |
| `collection_items` | `id, collection_id, product_id nullable, style_reference_id nullable, note, position` | collections, products, style_references | as collections |

### Commerce
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `orders` | `id, org_id, order_no text unique, mode order_mode, status order_status, buyer_profile_id nullable, buyer_contact jsonb (private), currency text default 'SGD', subtotal_sgd, shipping_charge_sgd, total_sgd, external_reference text nullable, placed_at, paid_at` | profiles | buyer self read; owner full; service |
| `order_items` | `id, order_id, product_id, unit_price_sgd, quantity int default 1` | orders, products | as orders; seller-self read own items (buyer fields stripped via view) |
| `payments` | `id, order_id, mode order_mode, provider text default 'simulated', status payment_status, amount_sgd, provider_reference text, state_log jsonb` | orders | owner; service |
| `refunds_returns` | `id, order_id, order_item_id nullable, reason text, amount_sgd, status text, requested_at, resolved_at` | orders, order_items | owner; buyer self read |

### Intelligence & experiments
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `insights` | `id, org_id, type insight_type, title, body, confidence numeric(3,2), owner_id, sample_size int, affected_drop_id nullable, created_by` | drops, profiles | owner; analyst read |
| `experiments` | `id, org_id, name, hypothesis, primary_metric text (metric_definitions.key), guardrail_metrics text[], unit_of_assignment experiment_unit, variant_a jsonb, variant_b jsonb, start_at, end_at, sample_target_or_rationale text, confounders_notes text, status experiment_status, conclusion text, conclusion_strength conclusion_strength` (mirrors §12.4 exactly) | — | owner; analyst read |
| `experiment_assignments` | `id, experiment_id, unit_key text (session/product/campaign/drop id), variant text, assigned_at` | experiments | service write; owner read |
| `metric_definitions` | `key text pk (e.g. 'sell_through'), name, formula text, denominator text, guardrail text, sql_view text` | — | public read; owner write |
| `metric_snapshots` | `id, metric_key, scope jsonb (drop_id etc.), value numeric, period_start, period_end, sample_size int, captured_at` | metric_definitions | owner; analyst read; used by portfolio snapshots |

### Style Engine
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `style_references` | `id, profile_id nullable, source text (upload/url), url text, asset_path text, note text` | profiles | self; owner read |
| `style_reference_attributes` | `id, style_reference_id, dimension taxonomy_dimension, tag_id nullable, free_value text, confidence numeric(3,2), source tag_source` | style_references, tags | as style_references |
| `closet_items` | `id, profile_id, title, category_id, color text, fit_notes text, photo_asset_path text, wear_frequency text, ownership_source text` | profiles, tags | self only (private by default §15.2) |
| `outfits` | `id, profile_id nullable, style_session_id, title, thesis text, climate text, occasion text, is_saved bool` | profiles, style_sessions | self; session owner |
| `outfit_items` | `id, outfit_id, product_id nullable, closet_item_id nullable, style_reference_id nullable, placeholder_label text, role text (hero/layer/footwear/...)` | outfits, products, closet_items, style_references | as outfits |
| `style_sessions` | `id, org_id, profile_id nullable, session_id, mode style_mode, inputs jsonb (references, occasion, climate, budget, owned items), result jsonb, deterministic bool default false, ai_generation_id nullable` | profiles, sessions, ai_generations | self/session; owner read |
| `style_feedback` | `id, style_session_id, label style_feedback_label, failure_mode style_failure_mode nullable, note text, created_by nullable` | style_sessions | self write; owner read |

### AI governance
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `ai_prompt_versions` | `id, feature text, version int, system_prompt text, user_template text, created_by; unique(feature, version)` | — | owner |
| `ai_generations` | `id, org_id, feature text, provider text, model text, prompt_version_id, system_prompt_hash text, input_entity_refs jsonb, input_asset_refs jsonb, output_text text, output_asset_path text, raw_response_private text, created_by, status ai_generation_status default 'draft', human_editor_notes text, disclosure_required bool default false, disclosure_text text, safety_or_truth_flags text[]` (mirrors §13.3 exactly) | ai_prompt_versions, profiles | owner only (raw AI output never public §20.3) |

### Garment & product labs
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `garment_projects` | `id, org_id, title, problem_statement, problem_kind text (fit/pockets/movement/proportion/modularity/comfort/waste/upcycling), product_id nullable, before_notes text, status text` | products | owner |
| `garment_tests` | `id, garment_project_id, kind text (wear_test/clo_simulation/prototype_test), tester_label text (pseudonymous), consent_obtained bool, context text, feedback text, discrepancies_vs_simulation text, tested_at` | garment_projects | owner |
| `garment_assets` | `id, garment_project_id, kind text (flat/clo_project/render/fit_map/prototype_photo/before_photo), asset_path, version int, caption text (what the image is intended to show §9.4), ai_generation_id nullable` | garment_projects, ai_generations | owner |
| `product_briefs` | `id, org_id, title, problem, evidence text, current_workaround text, target_outcome text, status text` | — | owner |
| `prds` | `id, product_brief_id, competitor_matrix jsonb, user_stories jsonb, functional_requirements jsonb, nonfunctional_requirements jsonb, mvp_scope text, deferred_features text, success_metrics jsonb` | product_briefs | owner |
| `prototype_tests` | `id, prd_id, prototype_url text (Figma), tester_label, observation text, confusion_notes text, tested_at` | prds | owner |

### Portfolio
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `portfolio_projects` | `id, org_id, slug text unique, title, one_line_problem, role_lens text (merchandising/buying/ecommerce/analytics/fashion_tech/garment/kpop_merch/creative), contribution text, context_constraints text` | — | owner |
| `portfolio_artifacts` | `id, portfolio_project_id, kind text (image/chart/link/metric_snapshot), asset_path, url, metric_snapshot_id nullable, caption, sort_order` | portfolio_projects, metric_snapshots | owner |
| `portfolio_snapshots` | `id, portfolio_project_id, slug text unique, version int, frozen_payload jsonb (full rendered case study, §21.2 fields), is_public bool default false, frozen_at, published_at` | portfolio_projects | public read where is_public; owner write. FROZEN: edits to source data never mutate a snapshot (§6.4 rule 8) |

### Ops
| Table | Key columns | FKs | RLS |
|---|---|---|---|
| `audit_log` | `id, org_id, actor_id, action text, entity_type, entity_id, before jsonb, after jsonb, created_at` (append-only) | profiles | owner read; service write |
| `jobs` | `id, org_id, kind text, status job_status, payload jsonb, retry_count int default 0, last_error text, run_at, finished_at` | — | owner read; service write |
| `system_incidents` | `id, org_id, severity text, title, detail, started_at, resolved_at, annotation_only bool default false` (doubles as launch incident log §7.7) | — | owner |

## 3. Controlled taxonomy (§11.3 — seeded in 0014, operator-editable)

| Dimension (`taxonomy_dimension`) | Seed values (slugs) |
|---|---|
| `category` | outerwear, top, shirt, knitwear, trouser, denim, skirt, dress, footwear, bag, accessory, other |
| `silhouette` | boxy, cropped, fitted, oversized, relaxed, straight, wide, flared, tapered, draped, structured |
| `proportion` | long-over-short, short-over-long, balanced, top-heavy, bottom-heavy, layered |
| `material` | cotton, denim, leather, wool, knit, nylon, polyester, linen, silk, rayon-viscose, mesh, mixed-unknown |
| `palette_role` | neutral, monochrome, low-contrast, high-contrast, accent-color, earth, jewel, pastel, metallic |
| `energy` | clean, sharp, soft, rugged, romantic, sporty, futuristic, archival, playful, formal, utilitarian |
| `era` | 70s, 80s, 90s, 2000s-y2k, contemporary, vintage-uncertain |
| `aesthetic` | streetwear, minimal, workwear, blokecore, blokette, gorpcore, darkwear, prep, romantic, techwear, archival, tailored, other |
| `climate` | hot-humid, indoor-aircon, mild, cold (+ breathability/layering notes as tag description) |
| `use` | daily, work, nightlife, event, travel, active, editorial, special-occasion |

## 4. Tag confidence rules (§11.4)

1. Every `tag_assignments` row stores `source tag_source` and `confidence numeric(3,2)` (null for human).
2. AI-suggested tags (`source='ai_suggestion'`) are created with `accepted=false`; they are NOT canonical truth until an operator accepts when the field is consequential (condition, ownership, material certainty, sizing — §13.4).
3. Conflicting tags are allowed on research entities (`source_listings`, `style_references`) but must be resolved (exactly one accepted tag per single-valued dimension) before a product is publicly presented.
4. Taxonomy changes are versioned (`tags.version`); old terms stay with `is_active=false` and `tag_aliases` preserves mappings so historical analytics never break.
5. `products.category_id` is a hard FK to `tags` where `dimension='category'` (single-valued, enforced in app + check via trigger).

## 5. Migration plan (mechanical, ordered)

Each file is idempotent-where-possible and applied with `supabase db push` /
CI migration check. `supabase/seed.sql` is separate from migrations.

| # | File | Contents |
|---|---|---|
| 0001 | `0001_extensions_and_enums.sql` | pgcrypto/uuid; all enums in §1 |
| 0002 | `0002_identity.sql` | organizations, profiles (+ trigger to create profile on auth signup, default role `shopper`) |
| 0003 | `0003_taxonomy.sql` | tags, tag_aliases, tag_assignments + indexes |
| 0004 | `0004_sellers.sql` | sellers, seller_contacts, agreements |
| 0005 | `0005_research.sql` | source_platforms (+ seed rows: Carousell, Instagram, SSQRD, manual, physical_market), source_listings (+ normalized_url unique index), research_observations |
| 0006 | `0006_catalog.sql` | products, product_variants, product_measurements, product_assets, ownership_records, permissions |
| 0007 | `0007_drops_campaigns.sql` | drops, drop_items, drop_hypotheses, campaigns, campaign_assets, campaign_posts, tracked_links |
| 0008 | `0008_shopper.sql` | sessions, favorites, collections, collection_items |
| 0009 | `0009_events.sql` | events (+ unique(org_id, client_event_id), index on (event_name, occurred_at), jsonb GIN on properties) |
| 0010 | `0010_commerce.sql` | orders, order_items, payments, refunds_returns, settlements |
| 0011 | `0011_intelligence.sql` | insights, experiments, experiment_assignments, metric_definitions, metric_snapshots |
| 0012 | `0012_style_ai.sql` | style_references, style_reference_attributes, closet_items, style_sessions, outfits, outfit_items, style_feedback, ai_prompt_versions, ai_generations |
| 0013 | `0013_rls_policies.sql` | ENABLE RLS + all policies per §2 matrix (RLS tests target this file) |
| 0014 | `0014_taxonomy_seed.sql` | §3 seed values (idempotent upserts) |
| 0015 | `0015_metric_views.sql` | canonical SQL views (EVENTS_AND_METRICS.md §2) + metric_definitions rows |
| 0016 | `0016_labs.sql` | garment_projects, garment_tests, garment_assets, product_briefs, prds, prototype_tests |
| 0017 | `0017_portfolio.sql` | portfolio_projects, portfolio_artifacts, portfolio_snapshots |
| 0018 | `0018_ops.sql` | audit_log, jobs, system_incidents + updated_at triggers |
| — | `supabase/seed.sql` | Deterministic demo seed per §23.4/§23.5 (20–30 listings, 12–15 products, 3–4 sellers, Drop #001 live + Drop #002 planned, 2 campaigns, tracked links, 300–500 events, 1 garment case, 1 style user, 2 portfolio snapshots; FA-001…FA-010 sample products) |

Dependency notes: 0006 needs 0003/0004; 0007 needs 0006; 0010 needs 0006/0007;
0012 needs 0003/0008; 0015 needs 0009/0010; RLS (0013) is applied after all core
tables exist and re-touched by later migrations if tables are added (0016/0017/0018
include their own `enable row level security` + policies appended in-file so policy
and table land together; 0013 covers 0002–0012).

## 6. Settlement mathematics (§10.4 — canonical, unit-tested)

```
gross_sale_sgd            = sum(order_items.unit_price_sgd) + orders.shipping_charge_sgd
platform_fees_sgd         = payment_fee + marketplace_fee + other_transaction_fee
seller_base_sgd           = agreements.seller_fixed_amount_sgd
                            OR (item_sale_price * agreements.seller_share_pct / 100)
fitarchive_gross_sgd      = item_sale_price - seller_base_sgd
fitarchive_contribution_sgd = fitarchive_gross_sgd - platform_fees_sgd
                              - fitarchive_shipping_subsidy_sgd - campaign_variable_cost_sgd
```

Never display "profit" without stating whether overhead, labor, returns and unsold
inventory are included. UI label: "FitArchive contribution", never "net profit".
