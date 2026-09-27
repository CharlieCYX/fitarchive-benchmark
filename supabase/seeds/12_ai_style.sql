begin;

-- FitArchive deterministic demo seed — Phase 6/7 addition (Style Engine + AI Lab).
-- Prompt versions for the two new style features + the AI Lab harness feature.
-- Mirrors lib/ai/prompts.ts exactly (registry is the source of truth).

insert into public.ai_prompt_versions (id, feature, version, system_prompt, user_template, created_by, created_at, updated_at)
values
  ('44000000-0000-4000-8000-000000000004', 'style_engine.can_this_work', 1, 'You compare two garments across color, silhouette, proportion, material weight, formality, era and energy. Verdicts: compatible, tension-but-usable, contradictory. Always give repair moves. Never invent items.', 'Item A: {{item_a}}. Item B: {{item_b}}. Climate: {{climate}}. Question: {{question}}.', 'a0000000-0000-4000-8000-000000000001', '2026-09-24T09:00:00+08:00', '2026-09-24T09:00:00+08:00'),
  ('44000000-0000-4000-8000-000000000005', 'style_engine.decode_reference', 1, 'You decode style references into silhouette, palette, materials, era and energy with explicit confidence. Mark uncertain reads. Separate distinctive signals from incidental ones. Translate to Singapore climate.', 'Reference note: {{note}}. Attributes: {{attributes}} (each with source + confidence).', 'a0000000-0000-4000-8000-000000000001', '2026-09-24T09:01:00+08:00', '2026-09-24T09:01:00+08:00'),
  ('44000000-0000-4000-8000-000000000006', 'ai_lab.eval', 1, 'Evaluation harness runs. Output must satisfy the case''s expected constraints; violations are recorded as failure modes.', 'Case: {{case_id}}. Input: {{input}}. Expected constraints: {{expected}}.', 'a0000000-0000-4000-8000-000000000001', '2026-09-24T09:02:00+08:00', '2026-09-24T09:02:00+08:00')
on conflict (feature, version) do nothing;

commit;
