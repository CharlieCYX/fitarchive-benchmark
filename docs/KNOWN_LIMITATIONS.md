# Known Limitations

## Phase 8–9 — Garment Lab + Product Lab + Portfolio (current)

- **Verified unconfigured + at the pure-logic level.** Snapshot freeze
  assembly, §15.2 private-field stripping, evidence-graph ordering, CSV
  validation and ideation provenance are pure modules with 34 new unit
  tests; routes render 200 unconfigured and the three new APIs return
  honest 503s. No hosted Supabase exists in this workspace, so the
  configured write path (freeze insert, CSV insert) is verified by code
  review plus the Phase 2 Postgres harness pattern — the 0017
  frozen-snapshot immutability trigger itself was verified against real
  Postgres in Phase 2. Migration 0020 is additive (0019 pattern) and was
  statically checked, not executed against Postgres here.
- **Garment ideation uses the mock provider by default.** Output is labeled
  `[mock-ai …]`, recorded with full §13.3 provenance and stays `draft`; a
  real provider slots in via `AI_PROVIDER` without touching the round
  workflow. The mock's KO "translation" preserves the English source and
  states that it cannot translate — the machine-assisted flag is the honest
  part, the Korean is a placeholder until a real provider or human writes it.
- **Asset uploads are metadata records, not file uploads.** garment_assets
  and portfolio_artifacts store path + intent caption + version (+ optional
  ai_generation_id link); the Storage upload widget is out of scope for V1
  (same pattern as campaign assets).
- **CSV import resolves source_platform by exact name** (case-insensitive)
  against seeded platforms; unknown platforms are rejected per-row with the
  known list in the error. §23.3's category/aesthetic/color/material columns
  are validated but not mapped to taxonomy tags on import (they inform later
  tagging; mapping would require the tag-assignment UI).
- **Portfolio export of a private snapshot requires the owner session**;
  public snapshots export anonymously. The payload is re-validated and
  re-scanned for private keys on every export (defense in depth beyond the
  freeze-time guard).
- **Snapshot slugs are versioned** (`<slug>-vN`): unpublishing then
  republishing later versions means older public URLs go dark rather than
  silently changing content — that is the intended frozen-snapshot trade-off.

## Phase 6–7 — Archive + Style Engine + AI

- **Verified unconfigured + at the pure-logic level.** All style-engine
  constraint logic, the mock provider, the structured-output validator and
  the eval harness are pure and unit-tested (55 new tests); routes render 200
  unconfigured and `/api/style/generate` produces full deterministic results
  without a database. No hosted Supabase exists in this workspace, so the
  persisted path (style_sessions, ai_generations, feedback events) is verified
  by code review + the Phase 2 Postgres harness pattern, not clicked live.
- **The mock provider is deliberately not an LLM.** It composes deterministic,
  context-derived text (labeled with a `[mock-ai …]` disclosure on every
  output) and satisfies the structured-output contract. `analyzeImage`/`embed`
  are intentionally unimplemented — §13.1 marks them optional and §17.3
  requires full function without paid AI. A real provider slots into
  `getAIProvider()` without touching callers.
- **AI narration is additive, never decisive.** The engine's deterministic
  text is always included; the provider's re-wording is appended and any
  malformed/schema-breaking output falls back with a
  `malformed_provider_output` flag on the logged ai_generations row.
- **Closet items carry category + color only.** Without per-item attribute
  tagging UI, closet garments match style signals mainly on category/role;
  the engine is honest about this (owned items surface as neutral bases
  rather than pretending attribute certainty).
- **Anonymous style sessions are service-role writes** keyed to the
  pseudonymous `fa_sid` session (same trust model as event ingest):
  feedback/save actions verify ownership by profile id or matching anon
  session before writing. Possession of a session uuid is not sufficient.
- **Style references accept URLs and manual attribute tags, not image
  analysis.** `style_references.asset_path` is supported by the schema, but
  there is no upload widget or vision decode in V1 — Decode This Reference
  works from human-entered attributes (with confidence), which is the honest
  deterministic path.
- **Eval ratings are stored on the generation row** (`human_editor_notes`
  JSON + `safety_or_truth_flags`) rather than a separate ratings table —
  keeps the §13.3 provenance trail in one place; aggregating rating trends
  across runs would justify a real table later.
- **AI gateway rate limit is per-instance** (same in-memory limiter trade-off
  as /api/events, Phase 4).

## Phase 5 — Analytics

- **Dashboards verified unconfigured + at the pure-logic/view level.** The
  metric views themselves were re-verified against the local Postgres harness
  (Phase 2 method), but no hosted Supabase project exists to click the UI
  end-to-end; unconfigured routes render the "Connect Supabase" state and
  every chart renders an honest empty state with no fabricated numbers.
- **Channel breakdown is presentation grouping, not a canonical metric.**
  §12.3's channel view (direct/social/referral/other) is computed by a pure,
  unit-tested classifier over raw `page_view` attribution columns — no §2
  metric formula is reimplemented. The classification rules are documented in
  `lib/metrics/format.ts` and labeled on the chart. Page-view aggregation reads
  at most 10,000 rows and labels itself when truncated.
- **Assortment/Research-vs-reality rollups group canonical per-product view
  rows** (`v_save_rate` / `v_inquiry_rate`) by taxonomy bucket; the rates
  themselves are never recomputed from raw events. Research (marketplace
  observations) and internal engagement are different populations — the panel
  shows them side by side and never as a ratio.
- **`campaign_ctr` is never shown as a rate.** Impressions are not
  instrumented, so the CTR column renders "— (no impressions)" per the §2
  guardrail, and `campaign_ctr` is excluded from dashboard snapshots.
- **`time_to_sale` snapshots store median days** (the view returns a Postgres
  interval; it is converted by the unit-tested parser). Snapshot values are
  point-in-time copies in `metric_snapshots`; portfolio freezing (Phase 9)
  consumes them via `portfolio_artifacts.metric_snapshot_id`.
- **Decision cards are insights titled `Decision — <chart>`.** The chart
  reference is a curated list matching the dashboard panels (free-form chart
  attachment would need a chart registry, out of scope for V1).
- **Insight owner is limited to owner/analyst profiles** in the form select;
  other roles can be attributed later without schema change.
- **Customer-behavior panel deferred per §12.3** ("no cohort/retention views
  until enough users"): session counts appear inside the channel and conversion
  panels, but no dedicated cohort chart exists yet.

## Phase 4 — Storefront + events

- **Storefront/checkout verified unconfigured, not against hosted Supabase.**
  All reads scope to published rows in SQL and all writes go through the
  service-role event/checkout services, but no hosted project exists in this
  workspace; end-to-end shopper flows were verified at the pure-logic level
  (unit tests) plus unconfigured route probes.
- **Rate limiting is per-instance.** `POST /api/events` uses an in-memory
  sliding window (120 events/min/IP); serverless deployments limit per
  function instance, not globally. A shared store (e.g. Postgres-backed
  bucket) is the follow-up if abuse becomes a concern.
- **Colour filter is a text match, size filter needs variant rows.** There is
  no structured colour field in V1 (taxonomy has `palette_role`, not colour),
  so `color=` matches title/brand/description text and is labeled as such.
  `size=` matches `product_variants.label`; the seed has no variant rows, so
  the facet matches nothing until variants exist. Both are labeled honestly in
  the filter bar.
- **Demo checkout order id is the bearer reference.** `/checkout/[orderId]`
  loads the order via the service role; possession of the uuid grants view/
  resolve access to that demo order. Acceptable for simulated payments (no
  PII required, no real money); a real payment adapter must add buyer-scoped
  authorization before this pattern ships for real orders.
- **Inquiry flow records the event only.** `inquiry_start` is written to the
  event stream (with a mailto fallback shown); there is no inquiries table in
  the 59-table schema, so no inbox exists to receive messages.
- **`search_result_click` linkage is best-effort.** It carries the
  `search_submit` event id only when the ingest API response was readable
  (fetch, not sendBeacon); unconfigured/unreachable ingest simply skips the
  click event rather than blocking navigation.
- **Product imagery renders as alt-text placeholder slots.** `product_assets`
  metadata (alt text, provenance, synthetic flag) is displayed honestly, but
  binary upload to Supabase Storage remains a later-phase integration, so no
  `<img>` tags are emitted (no broken images).
- **`/checkout/[orderId]` is an additive route** beyond the §23.1 canonical
  map — see ADR-009.

## Phase 3 — Operator core

- **Server actions verified against the local Postgres harness, not hosted
  Supabase.** All mutations (capture, promote, availability transitions,
  permission grant/revoke, publish gate, tracked links) target the real
  tables/RLS and degrade to the "Connect Supabase" state without env, but no
  hosted project exists in this workspace to click them through end-to-end.
- **Two §10.2 checks are attestations, not data.** "Personas documented" and
  "rollback verified" have no schema storage; the drop page shows them unmet
  and the publish form requires explicit operator checkboxes. The attestation
  is recorded implicitly by the `publication_change` audit row on the drop.
- **"Dashboard receiving test events" blocks fresh drops.** The check counts
  events tagged with the drop's id; a never-published drop has none until test
  traffic is sent (the seed's Drop #001 has 249). This is the spec's intent
  (§10.2) but means Drop #002 cannot publish before instrumentation is
  exercised — the failure reason says exactly that.
- **Availability: `sold` is terminal in Phase 3.** Returns/refunds arrive with
  commerce (Phase 4, `refunds_returns`); the state machine says so instead of
  offering a fake "un-sell".
- **Product imagery is metadata-only.** `product_assets` rows record
  bucket/path/alt/provenance/rights; actual binary upload to Supabase Storage
  is a later-phase integration (storage buckets untested here).
- **Campaign "copy" assets store a path/reference only.** Copy variants are
  managed as `campaign_posts.copy` (per-channel, scheduled); asset approval
  governs image/post assets. AI-generated copy lands in Phase 7 as
  `ai_generations` drafts linked via `campaign_assets.ai_generation_id`.
- **Drop reorder is position-swap via up/down buttons** (no drag-and-drop);
  each swap is a server action round-trip.
- **Seed products carry no `source_listing_id`.** The 0019 lineage column is
  populated by the promote action for new products; the pre-existing seeded
  products predate the inbox narrative and stay unlinked.
- **Seller CRM has no message log UI yet** (§7.4 "message log" is tracked via
  `research_observations` on listings and audit_log; a dedicated messaging
  surface is not built).

## Phase 2 — Database

- **Verified against a local Postgres, not hosted Supabase.** Migrations
  0001–0018 + seed run clean from zero on a real Postgres with `auth` shimmed
  (see TEST_REPORT.md Phase 2). The exact Supabase CLI path
  (`supabase db reset`, managed `auth` schema, storage buckets) is untested
  here because no Supabase project/Docker is provisioned in this workspace.
- **FA-001…FA-010 canonical product table was not available** in the contract
  docs (§23.5 references it but the table content is not reproduced in
  `docs/`), so the seed's FA-001…FA-014 rows were authored to the §23.4
  narrative (cropped/boxy outerwear + mid-price band). If the original table
  surfaces, swap the row contents — SKUs and narrative structure already match.
- **`time_to_sale` view is grouped per drop × category** (per the §2 spec); the
  seeded drop-level metric_snapshot (10.85 days) is the all-category median.
- **RLS granularity:** owner and seller share the `authenticated` DB role, so
  column-level privacy between them (e.g. seller must not read
  `products.cost_basis_sgd` on own rows beyond row scope) is enforced at the
  API layer, not by column privileges. Anon is fully locked down at the DB
  level (column grant list on `products`). A `v_seller_products`-style view can
  harden this later without contract change.
- **`v_dq_duplicate_sources` is empty by construction** — the
  `unique(org_id, normalized_url)` index makes duplicates impossible; the view
  documents/audits the invariant rather than catching live rows.
- **Event ordering in seed is type-grouped** (impressions, then views, …) with
  deterministic timestamps per row; interleaving realism is approximated by the
  timestamp spread, not by insertion order. Metric views don't care; a future
  generator pass could interleave if dashboards render raw feeds.
- **Seed is insert-only, not idempotent** (fixed PKs) — reset path is
  `supabase db reset` or the truncate script in `scripts/seed-reset.md`.

## Phase 1 — Foundation

- **Supabase not provisioned in this workspace.** The app is built and verified
  in demo shell mode (no credentials): auth, session roles and RLS are coded
  but exercised only against a real project once env vars are set. The Phase 1
  plan's RLS probe ("owner vs shopper demonstrably different") is covered by
  unit tests over the guard logic; DB-level RLS probes land with migration 0013.
- **Migrations 0001–0002 only** (enums, organizations, profiles + auto-create
  trigger, interim RLS). The full policy matrix is intentionally deferred to
  `0013_rls_policies.sql` per the migration plan (DATA_MODEL.md §5).
- **Studio sections are honest placeholders** ("Planned in Phase X"), not
  functional modules; Command Center stat cards render "No data yet" rather
  than fabricated numbers.
- **No webfonts are bundled.** The editorial display/sans pairing uses curated
  system font stacks (see `lib/design-tokens.ts`) so builds never depend on a
  font CDN. A self-hosted editorial face can replace them later without token
  changes.
- **Node 20 deprecation warning** from `@supabase/supabase-js` during build
  ("Node 20 and below are deprecated…"). Node 20 remains supported; A18 pins
  Node 20 LTS. Revisit when the project standardizes on Node 22.
- **Playwright browsers are not part of CI yet.** E2E smoke runs manually
  (`PLAYWRIGHT_BASE_URL` / `PLAYWRIGHT_WEBSERVER=1`); wiring browsers into CI
  is Phase 10 hardening.
- **ESLint pinned to 9.x**: `eslint-plugin-react` (transitive via
  `eslint-config-next@16`) is not yet compatible with ESLint 10's rule context
  API. Upgrade when the plugin supports it.
- **Milestone-push tooling gaps (this workspace only)**: the automation token
  used to push to GitHub lacks the `workflow` OAuth scope, so
  `.github/workflows/ci.yml` could not be committed remotely, and the 163KB
  `pnpm-lock.yaml` exceeds the per-call payload limit of the file-push tool.
  Both files exist, complete and verified, in the local working copy; push them
  from any environment with git credentials or a full-scope token
  (`git push origin main`). Until the lockfile lands remotely, run CI installs
  with `pnpm install` (non-frozen).
