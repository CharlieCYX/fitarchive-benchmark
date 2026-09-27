/**
 * Experiment status state machine (§12.4) + insight evidence-state language
 * (§9.2). Pure module — unit-tested in tests/unit/metric-format.test.ts.
 */

export const EXPERIMENT_STATUSES = [
  "draft",
  "running",
  "paused",
  "concluded",
  "abandoned",
] as const;

export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const EXPERIMENT_UNITS = ["session", "product", "campaign", "drop"] as const;
export type ExperimentUnit = (typeof EXPERIMENT_UNITS)[number];

export const CONCLUSION_STRENGTHS = [
  "inconclusive",
  "directional",
  "repeated_evidence",
] as const;
export type ConclusionStrength = (typeof CONCLUSION_STRENGTHS)[number];

export const CONCLUSION_STRENGTH_LABELS: Record<ConclusionStrength, string> = {
  inconclusive: "Inconclusive",
  directional: "Directional",
  repeated_evidence: "Repeated evidence",
};

/** Allowed transitions; concluded/abandoned are terminal. */
const TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
  draft: ["running", "abandoned"],
  running: ["paused", "concluded", "abandoned"],
  paused: ["running", "concluded", "abandoned"],
  concluded: [],
  abandoned: [],
};

export function canTransition(from: ExperimentStatus, to: ExperimentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionError(
  from: ExperimentStatus,
  to: ExperimentStatus,
): string | null {
  if (from === to) return `Experiment is already ${from}.`;
  if (!canTransition(from, to)) {
    return `Cannot move from "${from}" to "${to}". Allowed: ${TRANSITIONS[from].join(", ") || "none (terminal state)"}.`;
  }
  return null;
}

/** Concluding requires a running/paused experiment and a written conclusion. */
export function concludeError(
  status: ExperimentStatus,
  conclusion: string,
  strength: ConclusionStrength | null,
): string | null {
  if (status !== "running" && status !== "paused") {
    return `Only a running or paused experiment can be concluded (current: ${status}).`;
  }
  if (conclusion.trim().length < 10) {
    return "Conclusion must be at least 10 characters — state what the data showed.";
  }
  if (!strength) return "Pick a conclusion strength.";
  return null;
}

// ---------- §9.2 evidence states ----------

/** Selectable evidence states — forecast is deliberately absent (disabled). */
export const EVIDENCE_STATES = [
  "observation",
  "hypothesis",
  "experiment",
  "validated_result",
] as const;
export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const EVIDENCE_STATE_LABELS: Record<EvidenceState, string> = {
  observation: "Observation",
  hypothesis: "Hypothesis",
  experiment: "Experiment",
  validated_result: "Validated result",
};

/** §9.2: forecast stays disabled until a minimum sample threshold + documented
 *  methodology exist. Surfaced verbatim in the UI next to the disabled option. */
export const FORECAST_DISABLED_REASON =
  "Forecast is disabled: FitArchive tracks evidence, it does not predict. A minimum sample threshold and a documented methodology are required before forecasts are allowed (§9.2).";

/** Language discipline: per-state writing guidance shown in the form. */
export const EVIDENCE_STATE_GUIDANCE: Record<EvidenceState, string> = {
  observation: "Describe only what was seen, with the sample it rests on. No claims about causes.",
  hypothesis: "State a testable claim and what result would support or refute it.",
  experiment: "Reference the running experiment this insight belongs to; no verdicts yet.",
  validated_result: "State the result, the repeated evidence behind it, and its scope limits.",
};
