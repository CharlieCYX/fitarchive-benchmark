# FitArchive Benchmark

FitArchive turns overlooked secondhand fashion into structured market intelligence,
curated drops, measurable commerce, better product decisions and fashion-tech
experiences — with the evidence trail to prove how every decision was made.

This repository is the **benchmark sandbox**: an intentionally ambitious full-stack
build specified by the FitArchive Build Bible (see `docs/reference/`). It is separate
from any real production FitArchive project.

## Stack

TypeScript · Next.js (App Router) + React · Tailwind · Supabase (Postgres + Auth +
Storage, RLS everywhere) · Netlify-compatible deploy · Vitest (unit) + Playwright
(E2E) · GitHub Actions CI · provider-neutral AI adapter (mock provider by default —
the app works fully without paid AI).

## Documentation map (read in this order)

| Doc | Contents |
|---|---|
| `docs/reference/BUILD_BIBLE_SUMMARY.md` | Distillation of the governing spec: MUST rules, acceptance criteria, hard-fail conditions |
| `docs/reference/ROADMAP_SUMMARY.md` | Distillation of the FitArchive Master Roadmap 2026–2027 (strategy, 21 phases, guardrails) |
| `docs/ARCHITECTURE.md` | System map, module boundaries, repo shape, route & API maps, architectural rules |
| `docs/DATA_MODEL.md` | Full relational schema (59 contract tables + additive extensions), enums, RLS matrix, taxonomy, migration plan |
| `docs/EVENTS_AND_METRICS.md` | Event dictionary, canonical metric definitions (SQL views), experiment object |
| `docs/IMPLEMENTATION_PLAN.md` | Phase-by-phase deliverables and exit conditions |
| `docs/ASSUMPTIONS.md` | Defaults for everything the spec leaves open |
| `docs/DECISIONS.md` | Architectural decision records (ADRs) |

Table, route and event names in these docs are a **binding contract** for all code.

## Getting started

Requires Node 20 (see `engines`) and pnpm 10 (pinned in `packageManager` — run
via `corepack pnpm` if pnpm is not on your PATH).

```bash
corepack pnpm install     # install dependencies (lockfile is committed)
cp .env.example .env.local  # optional: fill in Supabase values
corepack pnpm dev         # http://localhost:3000
```

Without Supabase credentials the app still boots in **demo shell mode**: public
pages render, `/api/health` reports `supabaseConfigured: false`, and auth/studio
show an explicit unconfigured notice instead of crashing. To enable auth and
data, create a Supabase project, set `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (and `SUPABASE_SERVICE_ROLE_KEY` for server-side
privileged operations), and apply migrations:

```bash
supabase link --project-ref <ref>
supabase db push          # migrations 0001–0021 (incl. 0021 products column lockdown)
```

A zero-to-RLS-probed migration run also works locally without hosted Supabase
(ephemeral Postgres via pgserver):

```bash
python3 -m pip install pgserver "psycopg[binary]"
python3 tests/rls/probe.py   # applies 0001–0021, then runs 13 RLS probes
```

## Module status (Phase 10)

| Module | Status |
|---|---|
| Public storefront (drops, products, search) | Shipped — deterministic filters + hard-constraint query parse (§9.3) |
| Demo checkout (simulated payments) | Shipped — state machine, server-side events |
| Operator Studio (research, catalog, sellers, drops, campaigns, analytics, labs, portfolio) | Shipped — owner-only |
| Launch Control (§7.7) | **Deferred** — publish paths live in Catalog/Drops; see KNOWN_LIMITATIONS |
| Seller portal (`/seller`) | Shipped — read-only: own items, permissions, settlements |
| Settings (`/settings`, §15.2) | Shipped — profile display, JSON data export, data-rights requests |
| Style Engine + AI (mock provider default) | Shipped — deterministic + provider-optional |
| Tracked-link redirect (`/go/:code`) | Shipped — campaign_link_click + 302 |
| §8.6 alternative finder | **Deferred** — PDPs show related pieces instead |
| CSV export | Not built — portfolio JSON export only |

Everyday commands:

```bash
corepack pnpm lint        # ESLint (flat config, next/core-web-vitals + typescript)
corepack pnpm typecheck   # tsc --noEmit (strict)
corepack pnpm test        # Vitest unit tests (243 tests across 29 files)
corepack pnpm build       # production build
PLAYWRIGHT_WEBSERVER=1 corepack pnpm test:e2e   # Playwright smoke (needs pnpm build first)
python3 tests/rls/probe.py                      # migrations from zero + RLS probes (real Postgres)
```

Demo roles: owner / seller / shopper (seeded). Seed data is synthetic and labeled
as such. See `docs/IMPLEMENTATION_PLAN.md` for the build phases.

## Rules that can never regress

- No dead buttons or fabricated integrations on MUST features.
- No privileged secrets client-side; RLS on every private table, tested.
- Dashboards read first-party events via the canonical metric layer — never
  hard-coded numbers.
- AI output is suggestion + provenance until human approval; mock provider always
  works.
- Public portfolio pages render frozen snapshots only.
