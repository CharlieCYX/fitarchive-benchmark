# FitArchive Benchmark — Decision Records

Durable architectural decisions (ADRs). Process decisions (scope, priorities) live in
`IMPLEMENTATION_PLAN.md`; open defaults live in `ASSUMPTIONS.md` and get promoted here
once resolved.

## ADR-001 — Framework: Next.js App Router
**Context:** The spec names "Next.js or SvelteKit"; we need SSR for the editorial
storefront, server actions for admin mutations, and file-based routing for ~40 routes.
**Decision:** Next.js 15 App Router + TypeScript strict. Server components by default;
client components only where interaction demands it.
**Consequences:** Route map in ARCHITECTURE.md §23.1 maps 1:1 to `app/`. Server
components query Supabase directly (no client data-fetching waterfalls).

## ADR-002 — Database naming & identity conventions
**Decision:** snake_case table/column names exactly as listed in DATA_MODEL.md §2;
`org_id uuid not null references organizations(id)` on every org-scoped table;
money as `numeric(12,2)` in SGD; enums created once in migration 0001 and shared.
`organizations` exists from day one (multi-org in the data model, single-org in
practice) so RLS never needs a breaking rewrite.

## ADR-003 — RLS model: role-scoped, column-aware
**Context:** §5 defines six app roles (owner/seller/shopper/stylist/analyst/viewer)
backed by two Supabase DB roles (`authenticated`, `anon`) — app role lives on
`profiles.role`.
**Decision:** Every private table has RLS enabled with policies keyed off
`auth.uid()` joined to `profiles`. Public read access is granted only to
published products/drops and public portfolio snapshots. Column-level privacy
(`products.cost_basis_sgd`, `products.notes_private`) is enforced by a column-level
grant list for `anon` and by API-level field selection for `authenticated`, plus a
seller-scoped view if needed (see KNOWN_LIMITATIONS until a red-team pass forces a
view).
**Consequences:** The service role is used ONLY server-side for event ingest and
jobs; it never powers UI reads. All UI reads flow through RLS-enforced clients.

## ADR-004 — Payments: simulated now, provider-adapter seam
**Context:** No payment account credentials exist for this benchmark; §10.3 allows
`order_mode='demo'` as long as the state machine is complete.
**Decision:** Implement the full payment state machine (`initiated → authorized →
captured / failed / refunded`) against a `simulated` provider; wrap payment calls in
a `PaymentProvider` interface so Stripe (or another provider) can replace it by
configuration. Webhook endpoint exists and validates signature shape; demo orders
can drive it locally.
**Consequences:** Nothing in checkout lies: CTAs say "Simulated payment"; no card
data is ever collected. Order/payment/refund tables are production-shaped.

## ADR-005 — Reserved-word rename: references → style_references
**Decision:** `references` is a SQL reserved word; the tables are named
`style_references` and `style_reference_attributes` everywhere (spec acknowledged
the conflict). This is the only sanctioned deviation from the §11.1 table list.

## ADR-006 — Event ingest: thin API route, validated, deduplicated
**Decision:** `POST /api/events` is the single client-event ingest path
(`trackEvent` helper wraps it). Server validates `event_name` against the dictionary,
validates per-name properties schemas, stamps `occurred_at` server-side when absent,
and inserts with the service role. `client_event_id uuid` + `unique(org_id,
client_event_id)` makes sendBeacon/fetch replays idempotent (§19.1). A lightweight
in-memory rate limiter caps ingest per IP; heavy abuse protection (e.g. bot
detection) is deferred as not required for V1.
**Consequences:** Server-side events (checkout, settlements) insert via the same
writer function, bypassing HTTP. Dashboards only ever read `events` + metric views.

## ADR-007 — AI provider abstraction with a mock default
**Context:** §17.3 — the app must function fully without paid AI; §13 forbids
auto-publish and hidden generation.
**Decision:** `features/ai/provider.ts` defines `AIProvider` (structured JSON out).
`MockAIProvider` is deterministic, labeled, and covers decode + narration + garment
concepts. `AnthropicProvider` activates via `AI_PROVIDER=anthropic` + env key.
Every generation writes an `ai_generations` row with the full §13.3 provenance
field set before the UI can display it.
**Consequences:** Tests and CI run on the mock provider; nothing in the product
requires a network call to an AI vendor.

## ADR-008 — Portfolio = frozen snapshots
**Decision:** Public portfolio pages read `portfolio_snapshots.frozen_payload`
only. Freezing validates payload completeness (§15.2) and snapshots the referenced
metrics/artifacts. Editing source data (experiments, products, metrics) NEVER
mutates a published snapshot; a new snapshot version is created instead.
`is_public` gates anonymous access.
**Consequences:** Portfolio content is stable for external reviewers; the live app
can evolve without breaking shared links.

## ADR-009 — Demo checkout confirmation is an additive route
**Context:** §23.1 fixes `/checkout/success`, but an out-of-band payment confirmation
(pending orders, buyer revisiting the link) needs a resolvable state page before
success exists. The §10.3 state machine includes `pending`, which must be renderable.
**Decision:** Add `/checkout/[orderId]` as an additive route (§6.4 allows additions,
never removals/renames). It renders `pending` (with the resolve-payment form) or
`paid`/`fulfilled` states honestly, and redirects to `/checkout/success` after a
simulated capture. `/checkout/success` remains and is reached through the normal
pay flow.
**Consequences:** The buyer always has a linkable, resumable confirmation URL —
required because demo checkout "delivers" via the external reference note, and
buyer identity is optional for demo orders.

## ADR-010 — Canonical §6 REST endpoints are implemented as Next.js server actions
**Context:** ARCHITECTURE §6 lists canonical REST endpoints
(`POST /api/research/listings`, `POST /api/products`, `POST /api/drops`,
`POST /api/drops/:id/publish`, `POST /api/search`, `POST /api/webhooks/payment`).
The build uses Next.js App Router, where server actions are the idiomatic
mutation channel: they ride the same authenticated request context as the
pages that invoke them, need no client-side fetch plumbing, and keep the
cookie-bound (RLS-enforcing) Supabase client as the default path.
**Decision:** Owner-facing mutations from §6 (research listings, products,
drops, drop publish) are implemented as Next.js server actions under
`features/*/actions.ts` with zod validation + server-side role guards —
not as REST routes. The public/externally-callable API surface that remains
as real HTTP routes is exactly: `POST /api/events` (client event ingest),
`/api/style/*` (session + generate, browser-driven), `POST /api/ai/generate`
(owner provider gateway), `POST /api/portfolio/snapshot` (freeze),
`GET /api/export/portfolio/:id` (downloadable export), `POST /api/import/csv`
(file upload), plus additive `GET /go/:code` (tracked-link redirect,
ADR-worthy but additive: §7.6 requires the redirect target and no REST
endpoint was specified for it) and `GET /api/health`. `POST /api/search` is
realized as the `/search` page's server component + deterministic filter
params (§9.3 fallback); `POST /api/webhooks/payment` stays unimplemented
because no payment provider is configured (demo checkout is a state machine,
ADR-004).
**Consequences:** The §6 owner endpoints have no REST surface to secure or
rate-limit; their authorization is the server-action guard + RLS. External
integrators cannot call them as plain HTTP — acceptable for V1 (no external
consumers exist); if one appears, add thin `/api/*` wrappers over the same
feature services rather than duplicating logic.
