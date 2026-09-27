# features/portfolio — Portfolio Mode

Owning module (ARCHITECTURE.md §3) for routes: /studio/portfolio,
/portfolio/[slug]; APIs: POST /api/portfolio/snapshot,
GET /api/export/portfolio/:id.
Core tables: portfolio_projects, portfolio_artifacts, portfolio_snapshots.
Status: **live — Phase 9**.

- `lens.ts` (pure): the 8 §21 role lenses + per-lens emphasis copy.
- `evidence-graph.ts` (pure): §21.1 evidence-graph assembly — research →
  product/drop → campaign → events/metrics → insight → decision → next
  action; links point at real records or are labeled manual notes.
  Unit-tested.
- `snapshot.ts` (pure): §21.2 frozen payload schema (explicit allowlist),
  §15.2 private-key denylist guard, append-only versioning helpers.
  Unit-tested.
- `freeze.ts` (server-only): assemble → strip → guard → insert a NEW frozen
  snapshot row. Never mutates an existing snapshot (DB trigger
  protect_frozen_snapshot enforces; §6.4 rule 8).
- `service.ts` (server-only): builder queries + the public read path
  (frozen, published snapshots only).
- `actions.ts`: project/narrative/evidence/artifact CRUD, freeze,
  publish/unpublish, KO translation draft via the provider gateway —
  flagged machine-assisted until human-reviewed (§13.4).
