# features/ai — AI Lab (governance + eval harness)

Owning module (ARCHITECTURE.md §3) for routes: /studio/ai-lab, POST /api/ai/generate.
Core tables: ai_prompt_versions, ai_generations.
Status: **live — Phase 7**. Prompt registry in `lib/ai/prompts.ts`; provider adapter in `lib/ai/provider.ts`; §8.8 eval cases + harness (pure) + `/studio/ai-lab` UI; gateway in `app/api/ai/generate`.
