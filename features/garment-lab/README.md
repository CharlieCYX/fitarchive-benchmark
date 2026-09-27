# features/garment-lab — Garment Innovation Lab

Owning module (ARCHITECTURE.md §3) for routes: /studio/garments.
Core tables: garment_projects, garment_tests, garment_assets,
garment_ideation_rounds (0020).
Status: **live — Phase 8**.

- `service.ts` (server-only): list + detail queries (project, before/after
  measurements, tests, assets, ideation rounds with joined ai_generations
  provenance).
- `actions.ts`: project CRUD, measurement sets, asset records (intent
  captions required, §9.4), test records (consent enforced for named
  testers, §15.3), and `runIdeationRound` — AI ideation via the lib/ai
  provider gateway with a full §13.3 ai_generations row per round; output
  stays `draft` until the operator acts (§6.4 rule 6).
- `case-study.ts` (pure): assembles the final case study with simulated
  evidence (CLO simulations, renders, fit maps) strictly separated from
  physical evidence (wear/prototype tests, photos); discrepancies vs
  simulation are first-class. Unit-tested.
- `ideation.ts` (pure): round numbering + provenance completeness gate.
  Unit-tested.
