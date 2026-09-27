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
| `docs/DATA_MODEL.md` | Full relational schema (59 tables), enums, RLS matrix, taxonomy, migration plan |
| `docs/EVENTS_AND_METRICS.md` | Event dictionary, canonical metric definitions (SQL views), experiment object |
| `docs/IMPLEMENTATION_PLAN.md` | Phase-by-phase deliverables and exit conditions |
| `docs/ASSUMPTIONS.md` | Defaults for everything the spec leaves open |
| `docs/DECISIONS.md` | Architectural decision records (ADRs) |

Table, route and event names in these docs are a **binding contract** for all code.

## Getting started

> Placeholder — completed by Phase 1 (Foundation). Planned shape:
>
> ```bash
> pnpm install
> cp .env.example .env.local   # fill in Supabase values
> pnpm supabase start          # or link a hosted dev project
> pnpm supabase db push        # migrations 0001–0018
> pnpm supabase db seed        # deterministic demo dataset
> pnpm dev
> ```
>
> Demo roles: owner / seller / shopper (seeded). Seed data is synthetic and labeled
> as such. See `docs/IMPLEMENTATION_PLAN.md` for the build phases.

## Rules that can never regress

- No dead buttons or fabricated integrations on MUST features.
- No privileged secrets client-side; RLS on every private table, tested.
- Dashboards read first-party events via the canonical metric layer — never
  hard-coded numbers.
- AI output is suggestion + provenance until human approval; mock provider always
  works.
- Public portfolio pages render frozen snapshots only.
