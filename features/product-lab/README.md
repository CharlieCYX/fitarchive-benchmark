# features/product-lab — Product Lab / PRD Studio

Owning module (ARCHITECTURE.md §3) for routes: /studio/product-lab.
Core tables: product_briefs, prds, prototype_tests (+ 0020 columns:
instrumentation_plan, releases, postmortem).
Status: **live — Phase 8**.

- `service.ts` (server-only): brief list + detail (PRDs, prototype tests).
- `actions.ts`: brief CRUD; PRD create/update (competitor matrix, user
  stories, FRs/NFRs, MVP scope + deliberately-deferred list, success metrics
  + instrumentation plan written before coding, §9.5); prototype test
  observations; append-only feature build record (releases + feedback);
  postmortem including "what should not be built".
