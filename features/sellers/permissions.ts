/**
 * Permission ledger domain logic (§5.2, §7.4).
 * Pure module — unit-tested in tests/unit/permission-gate.test.ts.
 *
 * The 8 states form a lifecycle:
 *   observed_only → contacted → permission_referral | permission_consignment
 *     | owned | borrowed_for_content | prototype_permission → expired_revoked
 * Publishing a non-owned product requires a VALID permission (§7.4 AC);
 * revocation unpublishes affected products (server-side, features/sellers).
 */

export const PERMISSION_STATES = [
  "observed_only",
  "contacted",
  "permission_referral",
  "permission_consignment",
  "owned",
  "borrowed_for_content",
  "prototype_permission",
  "expired_revoked",
] as const;

export type PermissionState = (typeof PERMISSION_STATES)[number];

export const PERMISSION_STATE_LABELS: Record<PermissionState, string> = {
  observed_only: "Observed only",
  contacted: "Contacted",
  permission_referral: "Referral permitted",
  permission_consignment: "Consignment permitted",
  owned: "Owned",
  borrowed_for_content: "Borrowed for content",
  prototype_permission: "Prototype permission",
  expired_revoked: "Expired / revoked",
};

/** States in which public representation of the item is legitimate. */
export const PUBLISHABLE_STATES: readonly PermissionState[] = [
  "owned",
  "permission_consignment",
  "permission_referral",
  "borrowed_for_content",
  "prototype_permission",
];

/** Allowed forward transitions for the ledger UI (§5.2 lifecycle). */
const PERMISSION_TRANSITIONS: Record<PermissionState, readonly PermissionState[]> = {
  observed_only: ["contacted"],
  contacted: [
    "permission_referral",
    "permission_consignment",
    "owned",
    "borrowed_for_content",
    "prototype_permission",
    "expired_revoked",
  ],
  permission_referral: ["expired_revoked"],
  permission_consignment: ["owned", "expired_revoked"],
  owned: ["expired_revoked"],
  borrowed_for_content: ["expired_revoked"],
  prototype_permission: ["owned", "expired_revoked"],
  expired_revoked: [], // terminal — a NEW permission row re-opens the relationship
};

export function allowedPermissionTransitions(
  state: PermissionState,
): readonly PermissionState[] {
  return PERMISSION_TRANSITIONS[state];
}

export function isPermissionState(value: unknown): value is PermissionState {
  return (
    typeof value === "string" &&
    (PERMISSION_STATES as readonly string[]).includes(value)
  );
}

export interface PermissionLike {
  state: PermissionState;
  granted_at?: string | null;
  expires_at?: string | null;
  revoked_at?: string | null;
}

/**
 * A permission is valid for publishing when its state is publishable,
 * it is not revoked, and it is not expired (§5.2, §7.4).
 */
export function isPermissionValid(
  permission: PermissionLike,
  now: Date = new Date(),
): boolean {
  if (!PUBLISHABLE_STATES.includes(permission.state)) return false;
  if (permission.revoked_at) return false;
  if (permission.expires_at && new Date(permission.expires_at).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/** Why a permission blocks publishing, or null when it is valid. */
export function permissionBlockReason(
  permission: PermissionLike | null,
  now: Date = new Date(),
): string | null {
  if (!permission) return "no permission record exists";
  if (!PUBLISHABLE_STATES.includes(permission.state)) {
    return `state is ${permission.state} (not a grant)`;
  }
  if (permission.revoked_at) return "permission was revoked";
  if (permission.expires_at && new Date(permission.expires_at).getTime() <= now.getTime()) {
    return "permission expired";
  }
  return null;
}

export interface PublishGateInput {
  /** Latest ownership_records state for the product (null = no record). */
  ownershipState: PermissionState | null;
  /** Most recent permission row for product (or seller-scoped), if any. */
  permission: PermissionLike | null;
}

/**
 * §7.4 AC: publishing a non-owned product requires valid permission.
 * Owned items (ownership record state 'owned') need no seller permission.
 */
export function canPublishProduct(
  input: PublishGateInput,
  now: Date = new Date(),
): { ok: boolean; reason?: string } {
  if (input.ownershipState === "owned") return { ok: true };
  if (input.ownershipState === "expired_revoked") {
    return { ok: false, reason: "ownership record is expired/revoked" };
  }
  const reason = permissionBlockReason(input.permission, now);
  if (reason) return { ok: false, reason: `not owned and ${reason}` };
  return { ok: true };
}
