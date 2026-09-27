# FitArchive Benchmark — Events, Metrics & Experiments

Status: Phase 0 contract. Event names, property names and metric keys are binding.
Implements Build Bible §12. All metrics are served from the canonical SQL views in
migration `0015_metric_views.sql` via `lib/metrics` — never computed ad-hoc in UI.

## 1. Event dictionary (§12.1 — exact)

All events are rows in `events` (see DATA_MODEL.md). Every ingest via
`POST /api/events` must include `client_event_id` (uuid) for replay dedupe
(`unique(org_id, client_event_id)`), `event_name`, and a `session_id`. Shared
properties on every event: `session_id`, `occurred_at`, `route`, `referrer`.
`utm_*` below means `utm_source, utm_medium, utm_campaign, utm_content`.

| `event_name` | Required properties (in `properties` jsonb, plus shared) | Fired from |
|---|---|---|
| `page_view` | `route`, `referrer`, `session_id`, `campaign` (nullable), `utm_*` | all public routes |
| `drop_view` | `drop_id` | `/drops/[slug]` |
| `product_impression` | `product_id`, `drop_id`, `position` | drop/search grids |
| `product_view` | `product_id`, `drop_id` (nullable), `source` (drop_grid / search / direct / referral) | `/products/[slug]` |
| `product_save` | `product_id`, `collection_id` (nullable) | save action |
| `product_unsave` | `product_id` | unsave action |
| `share_click` | `product_id` XOR `drop_id`, `channel` | share UI |
| `inquiry_start` | `product_id`, `method` (form / external_platform) | PDP inquiry |
| `external_buy_click` | `product_id`, `destination`, `tracked_link_id` | referral buy CTA |
| `checkout_start` | `order_id` | demo checkout |
| `order_complete` | `order_id`, `revenue_sgd` | demo/manual order completion |
| `search_submit` | `query`, `parsed_filters` (jsonb), `result_count` | `/search` |
| `search_result_click` | `query_id` (the `search_submit` event id), `product_id`, `position` | `/search` |
| `style_session_start` | `mode` (`build_my_fit` / `can_this_work` / `decode_reference`) | `/style/*` |
| `style_result_generated` | `style_session_id`, `provider`, `model` | style engine |
| `style_feedback` | `style_session_id`, `label` (style_feedback_label enum) | style engine |
| `closet_item_add` | `closet_item_id` | `/archive` |
| `campaign_link_click` | `tracked_link_id` | tracked-link redirect |
| `portfolio_view` | `portfolio_snapshot_id`, `section` | `/portfolio/[slug]` |

Validation: `lib/validation/events.ts` holds a zod schema per event name;
`POST /api/events` rejects unknown names or missing required properties (400, logged
to `jobs`/`system_incidents` when systemic). Identity: pseudonymous `session_id` by
default; `profile_id` attached only when the user is authenticated (§15.2).

## 2. Canonical metric definitions (§12.2 — as SQL-view specs)

Each metric has: a `metric_definitions` row (`key`, `formula`, `guardrail`) and a
SQL view in `0015_metric_views.sql`. Views below are specified, not full DDL;
the coder implements them literally. All views filter `events` by an `@org_id`
parameter exposed through `lib/metrics`.

| Key / view | Definition (implementable spec) | Guardrail |
|---|---|---|
| `product_view_rate` / `v_product_view_rate` | `count(events where event_name='product_view') / count(events where event_name='product_impression')`, grouped by product/drop/period. Secondary: same with `count(distinct session_id)`. | Use unique-session version as secondary metric. |
| `save_rate` / `v_save_rate` | `count(distinct coalesce(profile_id::text, session_id::text)) with product_save / count(product_view events)`, per product. | Identity basis (user vs session) must be stated on the chart. |
| `inquiry_rate` / `v_inquiry_rate` | `count(inquiry_start) / count(product_view)` per product/drop. | Primary conversion proxy when transactions happen off-platform. |
| `external_ctr` / `v_external_ctr` | `count(external_buy_click) / count(product_view)` per product; segment by `properties->>'destination'`. | Track destination explicitly. |
| `purchase_conversion` / `v_purchase_conversion` | `count(distinct order_id from order_complete) / count(product_view)` (product basis) OR `/ count(distinct session_id)` (session basis). | Denominator MUST be labeled in UI. |
| `sell_through` / `v_sell_through` | `count(order_items joined to orders status in (paid,fulfilled)) / count(drop_items in drop)` per drop over defined period. | Only counts products offered in a drop; never research-observed listings. |
| `time_to_sale` / `v_time_to_sale` | `percentile_cont(0.5) within group (order by orders.paid_at - products.published_at)` per drop/category. | Median, not mean. |
| `gmv` / `v_gmv` | `sum(order_items.unit_price_sgd * quantity)` for completed orders per period/drop. | Topline only; not profit. |
| `fitarchive_contribution` / `v_fitarchive_contribution` | `sum(settlements.fitarchive_contribution_sgd)` per period/drop (settlement math in DATA_MODEL.md §6). | Never label "net profit". |
| `campaign_ctr` / `v_campaign_ctr` | `count(campaign_link_click per tracked_link_id) / impressions` per tracked link. | If impressions are unavailable, show clicks only — do NOT invent a rate. |
| `style_feedback_success` / `v_style_feedback_success` | `count(style_feedback label='nailed_it') / count(style_sessions with any feedback)`, segmented by `mode` and constraint type. | Segment by mode; tiny samples labeled. |

Data-quality views (also in 0015): `v_dq_missing_properties` (events missing
required props), `v_dq_duplicate_sources` (source_listings sharing normalized_url),
`v_dq_stale_permissions` (permissions past `expires_at` still linked to published
products). Shown on `/studio/analytics` data-quality panel (§12.3).

## 3. Dashboard views (§12.3 — route `/studio/analytics`)

Drop overview · Assortment (category/price/aesthetic/color/material with sample
counts) · Creative (tracked-link/post/asset performance) · Channel (direct, social,
Carousell referral, SSQRD referral, other/manual) · Research vs reality · Customer
behavior (session-level only; no cohort/retention views until enough users) ·
Data quality (views above). Every chart displays sample size; decision cards
(`insights`) can attach to any chart (§9.1).

## 4. Experiment object (§12.4 — canonical)

Maps 1:1 to the `experiments` table (DATA_MODEL.md §2):

```ts
interface Experiment {
  id: string
  name: string
  hypothesis: string
  primary_metric: string            // metric_definitions.key
  guardrail_metrics: string[]
  unit_of_assignment: 'session' | 'product' | 'campaign' | 'drop'
  variant_a: Record<string, unknown>
  variant_b: Record<string, unknown>
  start_at: string | null
  end_at: string | null
  sample_target_or_rationale: string
  confounders_notes: string
  status: 'draft' | 'running' | 'paused' | 'concluded' | 'abandoned'
  conclusion: string | null
  conclusion_strength: 'inconclusive' | 'directional' | 'repeated_evidence' | null
}
```

Evidence language is constrained by `insights.type` (§9.2): observation →
hypothesis → experiment → validated_result; `forecast` stays disabled until a
minimum sample threshold + documented methodology exist.

Example Drop #002 experiments to seed as drafts (§12.5): price-ladder shift (more
entry items), photography style (flat vs on-body for matched subset), collection
framing (generic vs sharper persona story), hero concentration, external discovery
route (tracked SSQRD/referral vs direct social).
