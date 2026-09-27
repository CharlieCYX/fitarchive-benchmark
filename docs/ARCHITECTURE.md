# FitArchive Benchmark — Architecture

Status: Phase 0 contract. Binding for all later coding agents. Table, route and event
names here must match `docs/DATA_MODEL.md` and `docs/EVENTS_AND_METRICS.md` exactly.

Sources: Build Bible (FitArchive_Kimi_Ultimate_Build_Challenge_2026.pdf) §4–§10, §23;
distilled in `docs/reference/BUILD_BIBLE_SUMMARY.md`.

---

## 1. System map (adapted from Build Bible §6.2)

```
Browser / PWA
├── Public Storefront & Portfolio        (route group app/(public))
├── Authenticated Shopper Archive        (route group app/(public)/archive, auth-required)
├── Operator Studio                      (route group app/studio)
└── Seller Portal                        (route group app/seller)
        │
        ▼
Next.js server actions / API routes      (app/api + colocated server actions)
├── Auth & authorization guard           (lib/auth — role check server-side, never client-trusted)
├── Catalog / Drop service               (features/catalog, features/drops)
├── Event service                        (features/analytics — validated event ingest)
├── Analytics service                    (lib/metrics — canonical SQL-view-backed metrics)
├── AI provider adapter                  (lib/ai — provider-neutral, server-only)
├── Import / export adapters             (lib/integrations — CSV, manual sources, SSQRD manual)
└── Portfolio renderer                   (features/portfolio — snapshot-based)
        │
        ▼
Supabase
├── Postgres (RLS on every private table)
├── Auth (email magic link — see ASSUMPTIONS)
├── Storage (public bucket: product/campaign media; private buckets: evidence, closet, AI raw)
└── Scheduled / edge functions only when justified
        │
        └──▶ External services ONLY through explicit typed adapters
             (email, payment sandbox/simulator, AI provider, manual discovery/referral sources)
```

Hard rule: no client component ever imports the service-role key, the AI provider
adapter, or `lib/db/admin` server clients. `NEXT_PUBLIC_` env vars are the only
client-visible configuration.

## 2. Stack (fixed by spec §6.1 — do not deviate without an ADR)

| Layer | Choice |
|---|---|
| Language | TypeScript (strict) |
| App | Next.js App Router + React |
| Styling | Tailwind + accessible component primitives |
| Backend | Supabase Postgres + Auth + Storage (+ edge functions when justified) |
| Deploy | Netlify-compatible (`netlify.toml`, preview per branch) |
| Tests | Vitest (unit) + Playwright (E2E) |
| CI | GitHub Actions: lint, typecheck, unit, migrations-from-zero, E2E smoke |
| Analytics | First-party `events` table + SQL views (canonical metric layer) |
| AI | Provider adapter behind server-only API; mock provider is the default |

## 3. Module boundaries (Build Bible §7–§10)

Each module owns its route subtree, its `features/<name>/` folder (UI wiring +
server actions) and its queries. Cross-module reads go through `lib/db` queries or
the metric layer — never through another feature's internal components.

| Module | Spec | Routes | Code home | Core tables |
|---|---|---|---|---|
| Command Center / Today | §7.1 | `/studio` | `features/` studio shell + `app/studio/page.tsx` | drop snapshots, permissions, jobs, system_incidents |
| Marketplace Research Inbox | §7.2 | `/studio/research` | `features/research` | source_platforms, source_listings, research_observations, tags, product_assets |
| Catalog / Product Master | §7.3 | `/studio/catalog` | `features/catalog` | products, product_variants, product_measurements, product_assets, ownership_records |
| Seller CRM + Permission Ledger | §7.4 | `/studio/sellers` | `features/sellers` | sellers, seller_contacts, permissions, agreements, settlements |
| Drop Builder | §7.5 | `/studio/drops` | `features/drops` | drops, drop_items, drop_hypotheses |
| Campaign Studio | §7.6 | `/studio/campaigns` | `features/campaigns` | campaigns, campaign_assets, campaign_posts, tracked_links, ai_generations |
| Launch Control | §7.7 | `/studio/launch` | `features/drops` (launch sub-module) | publication state on drops/products, launch_incidents (system_incidents), inventory events (events) |
| Public Drop Storefront | §8.1 | `/`, `/drops`, `/drops/[slug]`, `/products/[slug]`, `/search` | `app/(public)` + `components/editorial` | published products/drops only |
| Shopper Archive | §8.2 | `/archive`, `/archive/collections/[id]` | `features/archive` | favorites, collections, collection_items, closet_items, style_references |
| Style Engine (Build My Fit / Can This Work? / Decode This Reference) | §8.3–8.5, 8.7 | `/style`, `/style/build`, `/style/compatibility`, `/style/decode` | `features/style-engine` | style_sessions, style_feedback, outfits, outfit_items, style_references, style_reference_attributes |
| Sustainable / Secondhand Alternative Finder | §8.6 | `/search` (mode) | `features/style-engine` + `features/catalog` | products, source_listings, tracked_links |
| Style Engine evaluation | §8.8 | `/studio/ai-lab` (style cases) | `features/ai` | style_feedback (failure-mode labels), ai_generations |
| Intelligence Dashboard | §9.1–9.2 | `/studio/analytics`, `/studio/insights` | `features/analytics` | events, insights, experiments, metric_definitions, metric_snapshots |
| Natural-language fashion search | §9.3 | `/search`, `POST /api/search` | `features/analytics`? — no: `lib/ai` + `app/api/search` | events (search_submit, search_result_click) |
| Garment Innovation Lab | §9.4 | `/studio/garments` | `features/garment-lab` | garment_projects, garment_tests, garment_assets |
| Product Lab / PRD Studio | §9.5 | `/studio/product-lab` | `features/` product-lab (within `features/research`? no — own folder `features/product-lab` — see note) | product_briefs, prds, prototype_tests |
| Commerce / Drop OS (orders, settlement) | §10 | storefront checkout + `/studio` order views | `features/catalog` + `features/sellers` | orders, order_items, payments, settlements, refunds_returns |
| AI Lab (governance + eval harness) | §13.5 | `/studio/ai-lab` | `features/ai` | ai_prompt_versions, ai_generations |
| Portfolio Mode | §21 | `/studio/portfolio`, `/portfolio/[slug]` | `features/portfolio` | portfolio_projects, portfolio_artifacts, portfolio_snapshots |
| Auth & settings | §5, §15 | `(auth)` group, `/settings` | `lib/auth`, `app/(auth)` | profiles, organizations |
| Ops (jobs, audit, incidents) | §17 | `/studio` (health cards) | `lib/db` + `features/` studio | audit_log, jobs, system_incidents |

Correction to the naive reading of §6.3: §6.3 lists `features/` folders
`research, catalog, drops, campaigns, analytics, archive, style-engine, ai,
garment-lab, portfolio, sellers`. Product Lab has no §6.3 folder; we add
`features/product-lab` (ADR-006) so every §9.5 table has exactly one owning module.

## 4. Repository shape (Build Bible §6.3, made concrete)

```
fitarchive-benchmark/
├── app/
│   ├── (public)/            # /, /drops, /drops/[slug], /products/[slug], /search,
│   │                        # /archive (+/collections/[id]), /style(+build|compatibility|decode),
│   │                        # /portfolio/[slug]
│   ├── (auth)/              # /login, /auth/callback (magic link)
│   ├── studio/              # operator-only: research, catalog, sellers, drops, campaigns,
│   │                        # launch, analytics, insights, ai-lab, garments, product-lab, portfolio
│   ├── seller/              # seller portal: own items, permissions, settlements
│   ├── settings/            # profile / privacy / integrations
│   └── api/                 # REST endpoints per §23.2 (see §6 below)
├── components/
│   ├── ui/                  # primitives (button, input, dialog, table...)
│   ├── editorial/           # storefront/portfolio editorial blocks
│   ├── charts/              # metric-layer-backed chart components
│   └── forms/               # shared form patterns (react-hook-form + zod)
├── features/
│   ├── research/  catalog/  drops/  campaigns/  analytics/  archive/
│   ├── style-engine/  ai/  garment-lab/  product-lab/  portfolio/  sellers/
├── lib/
│   ├── auth/                # session, role guards (server-only)
│   ├── db/                  # supabase clients (browser / server / admin), typed queries
│   ├── metrics/             # canonical metric access layer (wraps SQL views)
│   ├── ai/                  # AIProvider interface, mock/kimi/openai adapters, prompt registry
│   ├── validation/          # zod schemas shared by API + forms
│   └── integrations/        # CSV import/export, manual-source adapters, SSQRD manual adapter
├── supabase/
│   ├── migrations/          # ordered SQL migrations (see DATA_MODEL.md §Migration plan)
│   └── seed.sql             # deterministic demo seed (§23.4/§23.5 narrative)
├── tests/
│   ├── unit/                # Vitest: metrics, settlement math, tag normalization, transitions
│   └── e2e/                 # Playwright: golden scenario (§16.2) + smoke
├── docs/
│   ├── ARCHITECTURE.md  DATA_MODEL.md  EVENTS_AND_METRICS.md
│   ├── IMPLEMENTATION_PLAN.md  ASSUMPTIONS.md  DECISIONS.md
│   └── reference/  ROADMAP_SUMMARY.md  BUILD_BIBLE_SUMMARY.md
├── public/
├── .env.example
└── README.md
```

## 5. Route map (Build Bible §23.1 — canonical)

| Route | Purpose | Audience |
|---|---|---|
| `/` | Public landing / current drop | public |
| `/drops` | Drop archive | public |
| `/drops/[slug]` | Drop story + products | public |
| `/products/[slug]` | Public product detail | public |
| `/search` | Search/discovery (deterministic + AI parse option) | public |
| `/archive` | Shopper Archive | shopper (auth) |
| `/archive/collections/[id]` | Saved collection | owner of collection |
| `/style` | Style Engine landing | public |
| `/style/build` | Build My Fit | public/session |
| `/style/compatibility` | Can This Work? | public/session |
| `/style/decode` | Decode This Reference | public/session |
| `/studio` | Command Center | owner |
| `/studio/research` | Marketplace Research Inbox | owner |
| `/studio/catalog` | Catalog / Product Master | owner |
| `/studio/sellers` | Seller CRM + Permission Ledger | owner |
| `/studio/drops` | Drop Builder | owner |
| `/studio/campaigns` | Campaign Studio | owner |
| `/studio/launch` | Launch Control | owner |
| `/studio/analytics` | Intelligence Dashboard | owner (+ analyst scoped read) |
| `/studio/insights` | Observations / Hypotheses / Experiments | owner |
| `/studio/ai-lab` | AI evaluation / provenance | owner |
| `/studio/garments` | Garment Innovation Lab | owner |
| `/studio/product-lab` | PRD / Product Lab | owner |
| `/studio/portfolio` | Portfolio builder | owner |
| `/seller` | Seller portal | seller (own records only) |
| `/portfolio/[slug]` | Public case study (frozen snapshot) | public |
| `/settings` | Profile / privacy / integrations | any authed user |

## 6. API / server-action map (Build Bible §23.2 — canonical)

Reads and simple role-scoped mutations use colocated **server actions**; the
following are the canonical **API endpoints**:

| Endpoint | Purpose | Server-side guard |
|---|---|---|
| `POST /api/research/listings` | Create manual source listing | owner |
| `POST /api/products` | Create/promote product (from source_listing) | owner |
| `POST /api/drops` | Create drop | owner |
| `POST /api/drops/:id/publish` | Readiness gate + publish | owner; runs §10.2 gate |
| `POST /api/events` | Record validated client event (dedupe on `client_event_id`) | public, rate-limited |
| `POST /api/search` | Search with deterministic + optional AI parse | public, rate-limited |
| `POST /api/style/sessions` | Create style session | public/session |
| `POST /api/style/generate` | Run style engine provider safely (fallback: deterministic) | session; AI flag |
| `POST /api/ai/generate` | Generic server-only provider gateway | owner |
| `POST /api/portfolio/snapshot` | Freeze portfolio snapshot | owner |
| `POST /api/import/csv` | Validated batch import (§23.3 schema) | owner |
| `GET /api/export/portfolio/:id` | Portfolio-safe export (strips private fields) | owner / public snapshot |
| `POST /api/webhooks/payment` | Only if sandbox/real provider configured | signature-verified |

Health/build metadata: `GET /api/health` (commit hash, build time) — added per §17.2.

## 7. Service boundaries

- **Catalog/Drop service** (`features/catalog`, `features/drops`): owns product
  lifecycle and availability state machine (`draft → available → reserved → sold |
  withdrawn`) and drop publication state. Only service that may flip `published_at`.
- **Event service** (`features/analytics` ingest + `POST /api/events`): the ONLY
  writer to `events`. Validates event_name against the dictionary
  (EVENTS_AND_METRICS.md), requires `client_event_id` for idempotent dedupe.
- **Analytics service** (`lib/metrics`): the ONLY reader used for metric display;
  every number in UI comes from a canonical SQL view in `lib/metrics` — no ad-hoc
  metric math in components (§6.4).
- **AI adapter** (`lib/ai`): server-only. Never writes canonical product data;
  writes `ai_generations` rows whose status is `draft` until human accept (§6.4, §13.4).
- **Import/export adapters** (`lib/integrations`): CSV/manual only. No scraping,
  no fabricated live integrations (§2.2). SSQRD = manual external-discovery source.
- **Portfolio renderer** (`features/portfolio`): reads through frozen
  `portfolio_snapshots`; public case studies NEVER read live operational tables (§6.4).
- **Payment**: demo checkout = simulated payment state machine writing `payments`
  rows with `mode='demo'`; external/manual orders recorded with `mode='external_manual'`
  (§10.3, ADR-004).

## 8. Architectural rules (Build Bible §6.4 — enforced)

1. Domain logic lives in `features/*` services and `lib/*`, not inside UI components.
2. All privileged writes go through server-side code or narrowly scoped RLS policies.
3. Every table storing user-, seller- or private project-owned data has an explicit
   RLS policy (see DATA_MODEL.md §RLS matrix).
4. Metrics are defined once in the semantic layer (`metric_definitions` rows +
   SQL views + `lib/metrics`); storefront and dashboards never compute the same
   metric two ways.
5. External integrations implement typed adapter interfaces and must be replaceable
   by local simulators (mock AI provider, simulated payment, CSV import).
6. AI calls never write directly to canonical product data; they create a
   suggestion/version (`ai_generations.status='draft'`) requiring acceptance.
7. Uploads store metadata: owner, checksum, file type, privacy bucket, provenance
   (see `product_assets`, `garment_assets`, `campaign_assets`).
8. All public case studies derive from a frozen `portfolio_snapshots` row so later
   operational edits never silently rewrite published portfolio evidence.

Additional binding conventions (Phase 0 decisions, see DECISIONS.md):

9. All money columns are `numeric(12,2)` in SGD and suffixed `_sgd`.
10. All timestamps are `timestamptz`, default `now()`; `created_at`/`updated_at` on
    every entity table.
11. Primary keys are `uuid default gen_random_uuid()`; org scoping via `org_id`
    FK to the single V1 organization.
12. The spec table `references` is renamed `style_references` (and
    `reference_attributes` → `style_reference_attributes`) because `references` is
    a SQL reserved word (ADR-005). All other table names are exactly as §11.1.
