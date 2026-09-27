# Known Limitations

## Phase 1 — Foundation (current)

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
