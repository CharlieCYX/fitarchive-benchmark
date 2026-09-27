# Known Limitations

## Phase 4 — Storefront + events (current)

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
