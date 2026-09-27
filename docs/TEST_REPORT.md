# Test Report

## Phase 1 — Foundation (2026-09-27)

Environment: Node v20.20.2, pnpm 10.20.0 (via corepack), Next.js 16.3.6,
TypeScript 5.9.x. Verification ran on a local-disk copy of the working tree
(`/tmp/fitarchive`) because the workspace filesystem (FUSE portal mount) cannot
host `node_modules` — see KNOWN_LIMITATIONS.

| Check | Command | Result |
|---|---|---|
| Install | `pnpm install` | ✅ clean, lockfile generated (`pnpm-lock.yaml`) |
| Lint | `pnpm run lint` (eslint .) | ✅ 0 errors, 0 warnings |
| Typecheck | `pnpm run typecheck` (tsc --noEmit) | ✅ clean |
| Unit tests | `pnpm test` (vitest run) | ✅ 4 files, 16 tests passed |
| Build | `pnpm run build` | ✅ 22 routes, all prerendered/dynamic as designed |
| E2E smoke | `PLAYWRIGHT_BASE_URL=… pnpm test:e2e` | ✅ 3 passed (landing, /api/health, studio shell) |
| Live route probe | `pnpm start` + curl | ✅ `/`, `/login`, `/studio`, `/seller`, `/portfolio/demo` → 200; `/api/health` → `{"status":"ok",…,"supabaseConfigured":false}` |

Unit test coverage (Phase 1 scope):
- `tests/unit/roles.test.ts` — role enum matches DATA_MODEL.md §1; studio /
  seller-portal / analytics / archive guard logic per ASSUMPTIONS A6.
- `tests/unit/design-tokens.test.ts` — single violet accent #5B3FD3, 4–64
  spacing rhythm, 6–10px radii (Build Bible §14.2).
- `tests/unit/env.test.ts` — graceful unconfigured Supabase detection.
- `tests/unit/validation.test.ts` — magic-link email schema.

Not yet run (later phases): DB/RLS probes (needs a provisioned Supabase
project + migration 0013), migration-from-zero in CI, full golden E2E
scenario (§16.2).
