/**
 * Product availability state machine (§7.3, ARCHITECTURE §7):
 *   draft → available → reserved → sold | withdrawn
 * Pure module — the only place transitions are defined; the server action
 * (features/catalog/actions.ts) enforces it and the audit trigger (0018)
 * logs every change. Unit-tested in tests/unit/availability.test.ts.
 */

export const AVAILABILITY_STATUSES = [
  "draft",
  "available",
  "reserved",
  "sold",
  "withdrawn",
] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

const TRANSITIONS: Record<AvailabilityStatus, readonly AvailabilityStatus[]> = {
  draft: ["available", "withdrawn"],
  available: ["reserved", "sold", "withdrawn", "draft"],
  reserved: ["available", "sold", "withdrawn"],
  // sold is terminal in Phase 3; returns/refunds land with commerce (Phase 4).
  sold: [],
  withdrawn: ["draft"],
};

export function isAvailabilityStatus(value: unknown): value is AvailabilityStatus {
  return (
    typeof value === "string" &&
    (AVAILABILITY_STATUSES as readonly string[]).includes(value)
  );
}

export function allowedAvailabilityTransitions(
  from: AvailabilityStatus,
): readonly AvailabilityStatus[] {
  return TRANSITIONS[from];
}

export function canTransitionAvailability(
  from: AvailabilityStatus,
  to: AvailabilityStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Human-readable reason a transition is blocked, or null when allowed. */
export function availabilityTransitionError(
  from: AvailabilityStatus,
  to: AvailabilityStatus,
): string | null {
  if (from === to) return `Product is already ${from}.`;
  if (canTransitionAvailability(from, to)) return null;
  if (from === "sold") {
    return "Sold is terminal — record a return/refund via commerce (Phase 4) instead.";
  }
  return `Cannot move from ${from} to ${to}. Allowed: ${
    TRANSITIONS[from].join(", ") || "none"
  }.`;
}

/**
 * Sellable check for publishing: only available items should be publicly
 * purchasable; draft/reserved/withdrawn must not be live (§7.5 stock gating).
 */
export function isSellable(status: AvailabilityStatus): boolean {
  return status === "available";
}
