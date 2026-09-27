# FitArchive Benchmark — Implementation Plan

Expands Build Bible §18.1 into concrete deliverables per phase, mapped to the repo
shape (ARCHITECTURE.md §4). Every phase ends with: `pnpm lint && pnpm typecheck &&
pnpm test` green + Playwright smoke green + a manual demo path + docs updated
(spec behavior rule 12–13). One agent owns architecture/schema contracts
(§18.2 coordination rule).

## Phase 0 — Understand (THIS PHASE)
**Scope:** Read both PDFs; architecture, data model, event/metric contracts, risks,
definition of done. No application code.
**Deliverables:** `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`,
`docs/EVENTS_AND_METRICS.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/ASSUMPTIONS.md`,
`docs/DECISIONS.md`, `docs/reference/*_SUMMARY.md`, `README.md`, `.gitignore`,
`.env.example`.
**Exit condition:** Contracts internally consistent; migration order defined. ✅

## Phase 1 — Foundation
**Deliverables:**
- `package.json`, `tsconfig.json`, `tailwind.config.ts` (tokens per §14.2: 4–64 spacing, violet `#5B3FD3`, muted semantic colors), `netlify.toml`, `next.config.ts`
- `components/ui/*` primitives; editorial type scale
- `lib/db/{client,server,admin}.ts` Supabase clients; `lib/auth/*` role guard
- `app/(auth)/login` + `/auth/callback` (email magic link); `profiles` auto-create
- Migrations 0001–0004, 0013 (partial: identity/seller policies), `supabase/seed.sql` skeleton
- `app/api/health/route.ts` (commit hash + build time, §17.2)
- `app/studio/page.tsx` shell with empty states
- GitHub Actions workflow: lint, typecheck, unit, migrate-from-zero
**Exit condition (spec):** Login + health + seeded studio shell. Roles `owner` and
`shopper` demonstrably different via RLS test.

## Phase 2 — Research + Catalog
**Deliverables:**
- Migrations 0005–0006 (+0013 policies), 0014 taxonomy seed
- `app/studio/research` + `features/research`: quick-capture form (<1 min), duplicate
  detection on `normalized_url`, screenshot upload to Storage, drop-candidate flag
- `app/studio/catalog` + `features/catalog`: product create/promote from listing
  (`POST /api/products`), variants, measurements, assets w/ provenance,
  ownership_records timeline, availability state machine
- `app/studio/sellers` + `features/sellers`: seller CRUD, agreements, permissions
  ledger; publish gate (no publish without valid permission for non-owned items)
- `POST /api/research/listings`, `POST /api/import/csv` (§23.3 schema)
- Unit tests: tag normalization, availability transitions, duplicate detection
**Exit condition (spec):** Operator can capture and promote a listing. Permission
gate blocks publishing a non-owned item without valid permission.

## Phase 3 — Drop + Campaign
**Deliverables:**
- Migration 0007 (+policies)
- `app/studio/drops` + `features/drops`: assortment order/tier (entry/core/hero),
  price ladder, assortment breakdown, readiness checklist (§10.2 as computed gate),
  clone Drop→Drop preserving `cloned_from_id`, hypotheses
- `app/studio/campaigns` + `features/campaigns`: moodboard, brief, calendar,
  channel plan, asset versions + approval, tracked_links with UTM, synthetic
  imagery disclosure flag
- `POST /api/drops`, `POST /api/drops/:id/publish` (readiness gate enforcement)
- `app/studio/launch`: publish/unpublish, stock overview, incident log
  (`system_incidents`), rollback
**Exit condition (spec):** Drop #001 can publish (seed data passes full §10.2 gate);
revoking a permission unpublishes affected products + writes `audit_log`.

## Phase 4 — Storefront + Events
**Deliverables:**
- Migrations 0008–0010 (+policies)
- `app/(public)`: `/`, `/drops`, `/drops/[slug]`, `/products/[slug]` (editorial,
  condition/ownership wording per §15.3, synthetic disclosure), save/favorite,
  inquiry, share
- Demo checkout: simulated payment state machine writing `orders`/`order_items`/
  `payments` (`mode='demo'`); external-manual order recording (`mode='external_manual'`)
- Event pipeline: `POST /api/events` + zod schemas per EVENTS_AND_METRICS.md §1;
  client beacon helper; dedupe on `client_event_id`
- E2E: anonymous browse → product view → save → inquiry/demo checkout
**Exit condition (spec):** End-to-end shopper path stores real events.

## Phase 5 — Analytics
**Deliverables:**
- Migration 0011, 0015 (metric views + metric_definitions rows)
- `lib/metrics/*` typed accessors; `components/charts/*` with sample-size labels
- `app/studio/analytics`: 7 dashboard views (EVENTS_AND_METRICS.md §3)
- `app/studio/insights`: observation/hypothesis/experiment objects + decision cards
  linked to drops; experiments CRUD per §12.4
- Unit tests: every metric formula against known fixtures (§16.1); dedupe test
  (replayed `client_event_id` counted once)
**Exit condition (spec):** Real events drive charts; zero hard-coded numbers.

## Phase 6 — Archive + Style Engine
**Deliverables:**
- Migration 0012 (style tables only; AI tables may land in Phase 7 — flag in plan)
- `app/(public)/archive` + `features/archive`: favorites, collections, closet_items
  (private by default), style_references with decoded attributes
- `app/(public)/style{,/build,/compatibility,/decode}` + `features/style-engine`:
  three modes with DETERMINISTIC rule engine first (constraint filtering over
  catalog/closet); style_feedback with labels + failure modes
- `POST /api/style/sessions`, `POST /api/style/generate` (deterministic fallback path)
**Exit condition (spec):** Three legacy modes work end-to-end without any AI
provider (deterministic mode).

## Phase 7 — AI Lab
**Deliverables:**
- `lib/ai`: `AIProvider` interface (§13.1), `MockProvider` (deterministic, default),
  optional real adapters keyed by `AI_PROVIDER`; prompt registry + `ai_prompt_versions`
- `POST /api/ai/generate` server-only gateway; every call writes `ai_generations`
  (§13.3 fields) with status `draft`; acceptance workflow writes `audit_log`
- `app/studio/ai-lab`: test cases, expected constraints, rating dimensions (§13.5),
  failure labels, last-tested model version; copy assistant + reference tag
  suggestions wired to catalog/campaigns (suggestion-only)
- AI contract tests: malformed JSON + hallucinated product id rejected safely (§19.1)
- Cost logging: tokens/units, estimated cost, feature, success/failure (§17.2)
**Exit condition (spec):** Mock provider always works; one real provider optional;
provenance on 100% of AI outputs.

## Phase 8 — Garment + Product Lab
**Deliverables:**
- Migration 0016 (+policies)
- `app/studio/garments` + `features/garment-lab`: project from real garment problem,
  before-state evidence, AI ideation rounds (via ai_generations), flats/CLO/fit-map
  uploads with "what this shows" captions, before/after comparison, prototype record
  with consent flag, simulated-vs-physical evidence separation
- `app/studio/product-lab` + `features/product-lab`: problem brief, competitor
  matrix, PRD, MVP boundary, success metrics, prototype_tests
**Exit condition (spec):** One garment case documented end-to-end; one PRD completed.

## Phase 9 — Portfolio Mode
**Deliverables:**
- Migration 0017 (+policies)
- `app/studio/portfolio` + `features/portfolio`: project builder pulling evidence
  graph (research→product→drop→campaign→events→metrics→insight→decision, §21.1),
  role-lens filters (§21), `POST /api/portfolio/snapshot` freezing `frozen_payload`
  (§21.2 fields), Korean translation draft flagged machine-assisted (§13.4)
- `app/(public)/portfolio/[slug]` reading ONLY frozen snapshots; print/PDF-friendly CSS
- `GET /api/export/portfolio/:id` — private-field stripping test (§16.1)
- Stress test: edit source product after freeze → snapshot unchanged (§19.1)
**Exit condition (spec):** Recruiter-ready public case study from frozen snapshot.

## Phase 10 — Hardening
**Deliverables:**
- Migration 0018; full RLS test suite (§16.1 red-team matrix: cross-seller, closet
  privacy, cost basis, draft campaigns, raw ai_generations, settlements)
- Golden E2E scenario §16.2 fully automated; visual smoke at 390px/430px (§20.6)
- Accessibility pass (§14.4), performance pass, error/empty/loading states audit,
  no-dead-button audit (§20.2 truth table)
- `docs/KNOWN_LIMITATIONS.md`, `docs/TEST_REPORT.md`; README "Getting started"
  finalized; seed/reset one-command verified from fresh clone
**Exit condition (spec):** Benchmark release candidate; §23.7 definition of done met.

## Phase 11 — Stretch (only after core stable)
SSQRD manual adapter + referral attribution (§22.1) · bilingual (EN/KO) portfolio ·
AI-assisted natural-language search parser hardening · PWA · additional analytics
(forecasts still gated by §9.2). Each with tests + seed + docs.

## Cross-phase guardrails (every phase)
- No dead buttons on MUST routes; honest labels on partial features (§2.2).
- No fabricated external integrations — adapters + simulators only.
- Service-role key server-only; RLS on every private table; tests prove it.
- Deterministic seed reset; dashboards read first-party events only.
- Progress reported in the §18.3 format (phase, files, tests, demo path,
  assumptions, limitations, next).
