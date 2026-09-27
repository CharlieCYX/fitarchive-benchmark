# Known Limitations

## Phase 2 — Database (current)

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
