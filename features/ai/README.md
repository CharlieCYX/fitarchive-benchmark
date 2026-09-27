# features/ai — AI Lab (governance + eval harness)

Owning module (ARCHITECTURE.md §3) for routes: /studio/ai-lab, POST /api/ai/generate.
Core tables: ai_prompt_versions, ai_generations.
Status: **planned — Phase 7**. UI wiring and server actions land in that phase;
cross-module reads go through `lib/db` queries or `lib/metrics`, never through
another feature's internals (rule §6.4.1).
