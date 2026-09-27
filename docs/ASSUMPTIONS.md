# FitArchive Benchmark — Assumptions

Reasonable defaults for things the Build Bible leaves open. Each is reversible;
reversing one requires updating this file and, if structural, an ADR in DECISIONS.md.

| # | Assumption | Default | Basis / impact |
|---|---|---|---|
| A1 | Auth method | Supabase Auth **email magic link** only. No password, no social login in V1. | §15.1 allows "magic link or password; social only if simple". Magic link is the lowest-friction secure default. |
| A2 | Currency | **SGD** everywhere; money columns `numeric(12,2)` suffixed `_sgd`; no FX. | Spec fields (`public_price_sgd`, `revenue_sgd`) and Singapore context. |
| A3 | Tenancy | **Single org** in V1: one row in `organizations` ("FitArchive"), all org-scoped tables carry `org_id` FK for future-proofing but no org switcher UI. | §11.1 "one FitArchive org in V1". |
| A4 | Checkout | **Demo Checkout = simulated payment state machine** (`payments.provider='simulated'`, states initiated→authorized→captured | failed | refunded, plus `simulated`). No real/sandbox payment credentials required. External/manual orders use `mode='external_manual'`. | §10.3. |
| A5 | AI provider | **`AI_PROVIDER=mock` default**: deterministic mock adapter always works offline. Real adapters (kimi/openai/anthropic/local) are optional config. | §13.1, §17.3 (paid AI is enhancement, not dependency). |
| A6 | Roles in V1 | `owner`, `seller`, `shopper` fully implemented with RLS; `stylist`, `analyst`, `viewer` exist in the enum but get scoped-read policies only (no dedicated UIs beyond portfolio). | §5 lists 7 roles; benchmark DoD (§23.7) requires owner/shopper/seller. |
| A7 | Seller portal login | A seller maps to at most one `profiles` row via `sellers.user_id`; portal is read-mostly (own items, permissions, settlements). | §5 access boundary. |
| A8 | Measurements | Stored in **centimetres** (`product_measurements.unit='cm'` default), method free text per §10.5. | §10.5 "unit + method". |
| A9 | Timezone | All timestamps `timestamptz`; display timezone **Asia/Singapore**; analytics day boundaries in SGT. | Singapore context; prevents §20.4 time-zone errors. |
| A10 | Slugs | Public URLs use `products.slug` / `drops.slug` / `portfolio_snapshots.slug` (human-friendly, unique per org), not uuids. | §23.1 routes use `[slug]`. |
| A11 | Product SKU | Format `FA-###` (seed uses FA-001…FA-010 per §23.5); unique. | §23.5. |
| A12 | Storage buckets | `public-assets` (published product/campaign media), `private-assets` (closet, evidence, raw AI outputs, garment files pre-release). Signed URLs for private. | §6.1, §15.1 uploads. |
| A13 | Events from anonymous users | Allowed and rate-limited; identity = pseudonymous `sessions.anon_id`; `profile_id` only when logged in. | §15.2. |
| A14 | `launch_incidents` / `inventory_events` (§7.7 objects) | Implemented as `system_incidents` rows (with `annotation_only` flag) and `events` rows respectively — no extra tables. | §11.1 has no such tables; avoids schema sprawl. |
| A15 | `publication_states` (§7.7) | Derived from `drops.status`/`drops.published_at` + `products.published_at`/`availability`; state changes logged to `audit_log`. | Same reasoning as A14. |
| A16 | Forecast module | Disabled entirely in V1 (no UI entry); `insights.type='forecast'` exists but is gated by feature flag off. | §9.2 minimum-sample rule. |
| A17 | Feature flags | Single `lib/config/flags.ts` (env-driven): AI, checkout, public accounts, garment lab, stretch modules. | §17.2 requires flags. |
| A18 | Package manager | **pnpm**; Node 20 LTS; lockfile committed. | §15.1 dependencies rule. |
| A19 | Korean copy | Optional field on portfolio snapshots; any AI-drafted Korean is labeled machine-assisted until human review. | §13.4. |
| A20 | Seed realism | All demo data labeled synthetic (banner + `seed.sql` comments); matches §23.4 narrative (Drop #001 evidence → Drop #002 hypothesis). | §23.4. |
