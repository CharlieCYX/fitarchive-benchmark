/**
 * Canonical metric access layer (ARCHITECTURE.md §7 rule 4): every number
 * shown in UI comes from here, backed by SQL views (migration 0015) and
 * metric_definitions — never ad-hoc math in components.
 *
 * Phase 2: the views and registry rows exist (0015_metric_views.sql).
 * Typed query accessors land with the analytics UI in Phase 5.
 */

/** Canonical metric keys — must match metric_definitions.key (0015). */
export const METRIC_KEYS = [
  "product_view_rate",
  "save_rate",
  "inquiry_rate",
  "external_ctr",
  "purchase_conversion",
  "sell_through",
  "time_to_sale",
  "gmv",
  "fitarchive_contribution",
  "campaign_ctr",
  "style_feedback_success",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

/** Metric key → backing SQL view (0015). Single source of truth. */
export const METRIC_VIEWS: Record<MetricKey, string> = {
  product_view_rate: "v_product_view_rate",
  save_rate: "v_save_rate",
  inquiry_rate: "v_inquiry_rate",
  external_ctr: "v_external_ctr",
  purchase_conversion: "v_purchase_conversion",
  sell_through: "v_sell_through",
  time_to_sale: "v_time_to_sale",
  gmv: "v_gmv",
  fitarchive_contribution: "v_fitarchive_contribution",
  campaign_ctr: "v_campaign_ctr",
  style_feedback_success: "v_style_feedback_success",
};

export { computeSettlement, demoPaymentFeeSgd } from "./settlement";
export type { SettlementInput, SettlementResult } from "./settlement";
