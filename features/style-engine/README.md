# Style Engine (features/style-engine)

## Purpose
Build My Fit + Can This Work? + Decode This Reference — the deterministic styling logic with AI-assisted re-wording (§8.3–8.5, §13).

## Data
- `style_sessions` (inputs, result, deterministic flag, ai_generation_id)
- `style_feedback` (label, failure_mode)
- `style_references` + `style_reference_attributes` (decoded attributes)
- `outfits` + `outfit_items` (saved boards)

## Behavior
- Constraint logic (climate, budget, availability, silhouette rejection) is deterministic, offline and unit-tested.
- The AI adapter (default: mock) can enhance narrative text; it never changes the decision, and malformed output falls back safely.

## Status
Status: **live — Phase 6**. Deterministic constraint logic in `rules.ts`/`build.ts`/`compatibility.ts`/`decode.ts` (pure, unit-tested); AI narrative wrapper in `narrative.ts`; orchestration in `run.ts`; APIs in `app/api/style/*`.
