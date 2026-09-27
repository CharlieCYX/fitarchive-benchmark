/**
 * Canonical metric access layer (ARCHITECTURE.md §7 rule 4): every number
 * shown in UI comes from here, backed by SQL views (migration 0015) and
 * metric_definitions — never ad-hoc math in components.
 *
 * Phase 1: no metric views exist yet. Phase 5 implements typed accessors
 * (sell_through, conversion, …) against the views. Until then, dashboards
 * render honest "no data yet" states — no hard-coded numbers.
 */
export const METRIC_LAYER_STATUS = "planned-phase-5" as const;
