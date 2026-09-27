# Test Report

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
| `supabase/seed.sql` applied | ✅ clean |
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
