# Test Report

## Phase 5 — Analytics (2026-09-29)

Environment: Node v20.20.2, pnpm 10.20.0, Next.js 16.3.6. Verification on the
local-disk copy (`/tmp/fitarchive-p5`) per the FUSE workaround.

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | ✅ clean (unchanged lockfile) |
| Lint | `pnpm run lint` | ✅ 0 errors, 0 warnings |
| Typecheck | `pnpm run typecheck` | ✅ clean |
| Unit tests | `pnpm test` | ✅ 18 files, 145 tests passed |
| Build | `pnpm run build` | ✅ 35 routes; `/studio/analytics`, `/studio/insights`, `/studio/experiments`, `/studio/experiments/[id]` all dynamic (`ƒ`) |
| Route probe (unconfigured) | `pnpm start` + curl | ✅ `/studio/analytics`, `/studio/insights`, `/studio/experiments` all 200, each rendering the "Connect Supabase" state — no fake numbers |
| Metric-view assertions | local Postgres harness (Phase 2 method, pgserver; `auth` shim + pgcrypto-line skip only) | ✅ migrations 0001–0019 + seed clean from zero; `v_sell_through` Drop #001 = 0.7500; `v_gmv` total 529.00; `v_fitarchive_contribution` 120.48; `v_dq_missing_properties` = 0; `v_dq_duplicate_sources` = 0; 11 metric_definitions; `v_campaign_ctr` 22 clicks; `v_style_feedback_success` 3 modes; `v_time_to_sale` rows present |
| §12.5 seed completeness | harness | ✅ exactly 5 draft experiments for Drop #002 (price-ladder, photography, collection framing, hero concentration, external discovery); every `primary_metric`/`guardrail_metrics` key exists in `metric_definitions` |

New unit coverage (2 new files, 20 new tests):
- `metric-format.test.ts` — rate/count/sample-size formatting (null renders "—",
  never a fabricated 0%); Postgres interval text → days (median time-to-sale);
  channel attribution grouping (UTM wins, referrer-host fallback, no-signal =
  direct); §9.2 evidence-state enum excludes `forecast` and the insight schema
  rejects it even though the DB enum contains it; §12.4 experiment state
  machine (legal transitions only, terminal states, conclude requires written
  conclusion + strength, running/paused only).
- `chart-geometry.test.ts` — nice axis maxima, bar fractions (no ÷0), line
  points with null gaps, donut slice paths (full circle split into two arcs).

Not run here: Playwright E2E for the analytics UI (browsers not in this
workspace's CI) and live hosted-Supabase exercise of the insight/experiment/
snapshot server actions (no project provisioned — actions are guarded via
`requireOwnerContext` and degrade to honest error banners).

## Phase 4 — Storefront + Events (2026-09-28)

Environment: Node v20.20.2, pnpm 10.20.0, Next.js 16.3.6. Verification on the
local-disk copy (`/tmp/fitarchive`) per the FUSE workaround.

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | ✅ clean (unchanged lockfile) |
| Lint | `pnpm run lint` | ✅ 0 errors, 0 warnings |
| Typecheck | `pnpm run typecheck` | ✅ clean |
| Unit tests | `pnpm test` | ✅ 16 files, 125 tests passed |
| Build | `pnpm run build` | ✅ 34 routes; `/api/events`, `/products/[slug]`, `/drops/[slug]`, `/checkout/[orderId]` dynamic (`ƒ`); `/drops`, `/search` static in unconfigured builds (they flip dynamic once env is present, because `getServerClient` then touches cookies) |
| Route probe (unconfigured) | `pnpm start` + curl | ✅ `/drops`, `/search?q=coat`, `/products/fa-001`, `/checkout/<uuid>` all 200, each rendering the "Connect Supabase" state — no fake catalog |
| Event API validation | curl POST invalid body / invalid JSON / share_click with both product_id+drop_id | ✅ 400 with named zod issues in each case |
| Event API unconfigured | curl POST valid `drop_view` without Supabase env | ✅ graceful 503 (`event ingest is not configured…`), not a 500 crash |

New unit coverage (4 new files, 40 new tests):
- `events-validation.test.ts` — dictionary coverage (exactly 19 names), valid
  samples for every storefront event, unknown-name/missing-prop/invalid-uuid
  rejection, share_click XOR, negative revenue rejection; dedupe contract via
  a memory writer honoring `unique(org_id, client_event_id)` (replay →
  `deduped`, store size stays 1, per-org scoping); identity is built from
  server context only (client-sent `session_id`/`profile_id` never reach the
  event row).
- `checkout-state.test.ts` — §10.3 state machine: created→pending→paid writes
  (order paid + paid_at, payment `simulated`, item sold), pending→failed
  releases the item (order cancelled, payment `failed`, item available),
  terminal states, illegal jumps, order-status mapping, demo order numbers.
- `storefront-query.test.ts` — published-only scoping predicate; price band,
  category, aesthetic, material, size (variant label), colour text match,
  availability filters; AND-semantics text query; all four sorts; query-param
  parsing drops junk; `parsed_filters` serialization; ownership wording →
  purchase mode mapping.
- `attribution.test.ts` — UTM extraction (URLSearchParams + query records,
  trimming, null normalization) and the sliding-window rate limiter (limit,
  window expiry, per-key isolation).

Not run here: Playwright E2E for the shopper path (browsers not in this
workspace's CI) and live hosted-Supabase exercise of the storefront/checkout
server actions (no project provisioned). The SQL-level dedupe constraint
itself (`unique(org_id, client_event_id)`) was verified against the local
Postgres harness in Phase 2; the Phase 4 tests cover the ingest orchestration
around it.

## Phase 3 — Operator core (2026-09-28)

Environment: Node v20.20.2, pnpm 10.20.0, Next.js 16.3.6. Verification on the
local-disk copy (`/tmp/fitarchive`) per the FUSE workaround.

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | ✅ clean (unchanged lockfile) |
| Lint | `pnpm run lint` | ✅ 0 errors, 0 warnings |
| Typecheck | `pnpm run typecheck` | ✅ clean |
| Unit tests | `pnpm test` | ✅ 12 files, 85 tests passed |
| Build | `pnpm run build` | ✅ 26 routes; new studio routes dynamic (`ƒ`) as designed |
| Route probe (unconfigured) | `pnpm start` + curl | ✅ `/studio`, `/studio/research`, `/studio/catalog`, `/studio/sellers`, `/studio/drops`, `/studio/campaigns` all 200, each rendering the "Connect Supabase" state |
| Migrations from zero | local Postgres harness (Phase 2 method) | ✅ 0001–0019 all clean; 60 base tables; `products.source_listing_id` present |
| Seed (regenerated) | harness | ✅ clean; measurements now cover all 12 Drop #001 items |
| §10.2 gate vs seed | SQL probe of gate inputs | ✅ Drop #001 satisfies all 14 computed checks (attestations are publish-form inputs) |

New unit coverage (6 new files, 54 new tests):
- `url-normalization.test.ts` — §7.2 dedupe: tracking-param strip, host/case
  normalization, param sorting, non-http rejection, same-listing equality.
- `availability.test.ts` — §7.3 state machine: happy path, release from
  reserved, sold is terminal, illegal-jump reasons.
- `permission-gate.test.ts` — §5.2 states + §7.4 publish gate: owned needs no
  permission; revoked/expired/non-grant block with named reasons.
- `readiness-gate.test.ts` — §10.2: exactly 16 checks; full pass; individual
  failures for permissions, size, tiers, measurements, pricing, descriptions,
  assets, tracked links, test events, fulfillment/returns wording, media
  rights, and the two manual attestations.
- `settlement-display.test.ts` — §10.4 wording: terms description, canonical
  row order, "never profit" label, Postgres numeric-string handling; plus
  assortment summary (tiers/categories/aesthetics/price ladder).
- `utm.test.ts` — §7.6 tracked links: UTM append/replace, non-http rejection,
  deterministic link codes.

Not run here: Playwright E2E for the new studio flows (browsers not in this
workspace's CI), live hosted-Supabase exercise of the server actions (no
project provisioned — actions are guarded and unit-tested at the pure-logic
level; DB-level behavior verified via the Postgres harness).

## Phase 1 — Foundation (2026-09-27)

Environment: Node v20.20.2, pnpm 10.20.0 (via corepack), Next.js 16.3.6,
TypeScript 5.9.x. Verification ran on a local-disk copy of the working tree
(`/tmp/fitarchive`) because the workspace filesystem (FUSE portal mount) cannot
host `node_modules` — see KNOWN_LIMITATIONS.

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | ✅ clean, lockfile generated (`pnpm-lock.yaml`) |
| Lint | `pnpm run lint` (eslint .) | ✅ 0 errors, 0 warnings |
| Typecheck | `pnpm run typecheck` (tsc --noEmit) | ✅ clean |
| Unit tests | `pnpm test` (vitest run) | ✅ 4 files, 16 tests passed |
| Build | `pnpm run build` | ✅ 22 routes, all prerendered/dynamic as designed |
| E2E smoke | `PLAYWRIGHT_BASE_URL=… pnpm test:e2e` | ✅ 3 passed (landing, /api/health, studio shell) |
| Live route probe | `pnpm start` + curl | ✅ `/`, `/login`, `/studio`, `/seller`, `/portfolio/demo` → 200; `/api/health` → `{"status":"ok",…,"supabaseConfigured":false}` |

Unit test coverage (Phase 1 scope):
- `tests/unit/roles.test.ts` — role enum matches DATA_MODEL.md §1; studio /
  seller-portal / analytics / archive guard logic per ASSUMPTIONS A6.
- `tests/unit/design-tokens.test.ts` — single violet accent #5B3FD3, 4–64
  spacing rhythm, 6–10px radii (Build Bible §14.2).
- `tests/unit/env.test.ts` — graceful unconfigured Supabase detection.
- `tests/unit/validation.test.ts` — magic-link email schema.

Not yet run (later phases): migration-from-zero in CI, full golden E2E
scenario (§16.2).

## Phase 2 — Database (2026-09-27)

Verification method: **real local Postgres** (pgserver-bundled PostgreSQL,
ephemeral instance) — the strongest available option. Two environment shims
were required and are the ONLY deviations from the committed files: (1) a
minimal `auth` schema (`auth.users`, `auth.uid()` reading
`request.jwt.claim.sub`) replacing Supabase's managed auth schema; (2) the
`create extension if not exists pgcrypto` line skipped locally because the
bundled Postgres lacks the pgcrypto package (`gen_random_uuid()` is core in
PG ≥ 13; Supabase always provides pgcrypto). `anon`/`authenticated` roles were
pre-created to mirror Supabase.

| Check | Result |
|---|---|
| Migrations 0001–0018 applied from zero, in order | ✅ all 18 clean |
| `supabase/seed.sql` + `supabase/seeds/*.sql` (11 files, `[db.seed] sql_paths` order) applied | ✅ clean |
| Table count | 60 base tables in `public` — exact 1:1 match with the §2 contract list (verified name-by-name) |
| Seed invariants | ✅ 24 listings, 15 products (14 published + 1 draft), 4 sellers, 2 drops, 2 campaigns, 6 tracked links, 472 events (300–500 required), 62 sessions, 92 taxonomy tags |
| Event dedupe (`unique(org_id, client_event_id)`) | ✅ replaying an event insert is a no-op; count unchanged |
| `v_sell_through` Drop #001 | ✅ 0.75 (9/12) |
| `v_gmv` | ✅ total SGD 529.00; Drop #001 SGD 491.00 |
| `v_fitarchive_contribution` | ✅ SGD 120.48 total (matches §10.4 math: 24.39+21.46+15.97+34.86+23.80) |
| `v_time_to_sale` / `v_product_view_rate` / `v_save_rate` / `v_campaign_ctr` / `v_style_feedback_success` | ✅ rows present; FA-001 view count 13, FA-IG-001 clicks 7, per-mode style success 1.0/1.0/0.0 |
| Data-quality views | ✅ `v_dq_missing_properties` = 0 rows, `v_dq_duplicate_sources` = 0 rows |
| Settlement identity constraints (§6) | ✅ 0 violations |
| Frozen portfolio snapshot immutability (ADR-006) | ✅ update to frozen_payload rejected by trigger |
| Unknown `event_name` | ✅ rejected by dictionary trigger |
| Non-category tag as `products.category_id` (§11.4 rule 5) | ✅ rejected by trigger |
| Audit triggers | ✅ seed writes logged (agreements ×4, permissions ×7, settlements ×5); availability change → `publication_change` row |
| **RLS smoke** (non-superuser roles) | ✅ anon: published products only (14), `cost_basis_sgd` permission denied, 0 sellers/events/closet/draft-drop rows, 1 public portfolio snapshot; seller (Mei): own 3 settlements only, no other seller's draft FA-015; seller (Kenzo): sees own draft; shopper: own 5 closet items, 0 settlements; owner: full 472 events |
| `pnpm test` (vitest) | ✅ 6 files, 31 tests (adds `settlement.test.ts` §10.4 fixtures byte-identical to seed rows, `phase2-sql.test.ts` static invariants) |
| `pnpm typecheck` / `pnpm lint` | ✅ clean |
| Seed determinism | ✅ generator output byte-stable across runs (sha256 verified); no volatile clock/random functions |

Not run here: against a hosted Supabase project (none provisioned in this
workspace), `supabase db reset` CLI path (documented in scripts/seed-reset.md),
Playwright E2E (unchanged app surface in this phase).
