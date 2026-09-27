/**
 * Public ownership wording (§10.5 product truth, §15.3 integrity): the
 * storefront states the operating model honestly — owned / consigned /
 * referral / borrowed — and derives which purchase path is allowed.
 * Pure module — unit-tested.
 */

export type OwnershipState =
  | "owned"
  | "permission_consignment"
  | "permission_referral"
  | "borrowed_for_content"
  | "observed_only"
  | "contacted"
  | "prototype_permission"
  | "expired_revoked";

export type PurchaseMode =
  | "checkout" // FitArchive sells it (owned / consigned) → demo checkout
  | "referral" // external seller fulfils → tracked outbound click
  | "none"; // not purchasable (borrowed for content, unclear state)

export interface OwnershipWording {
  label: string;
  description: string;
  purchaseMode: PurchaseMode;
}

const WORDING: Record<OwnershipState, OwnershipWording> = {
  owned: {
    label: "Owned by FitArchive",
    description:
      "Bought outright; FitArchive holds the piece and handles fulfilment and returns.",
    purchaseMode: "checkout",
  },
  permission_consignment: {
    label: "Consigned piece",
    description:
      "Sold on behalf of the original seller under a documented consignment agreement; FitArchive handles fulfilment.",
    purchaseMode: "checkout",
  },
  permission_referral: {
    label: "Referral listing",
    description:
      "Listed and fulfilled by an external seller with their permission. Buying happens on their platform via a tracked link; FitArchive never takes payment for this piece.",
    purchaseMode: "referral",
  },
  borrowed_for_content: {
    label: "Borrowed for content",
    description:
      "On loan for photography and editorial only — not for sale.",
    purchaseMode: "none",
  },
  prototype_permission: {
    label: "Prototype (permission granted)",
    description: "A lab prototype shown with permission — not for sale.",
    purchaseMode: "none",
  },
  observed_only: {
    label: "Observed listing",
    description:
      "Seen during market research; no seller permission. Not presented for sale.",
    purchaseMode: "none",
  },
  contacted: {
    label: "Seller contacted",
    description: "Permission requested, not yet granted. Not for sale.",
    purchaseMode: "none",
  },
  expired_revoked: {
    label: "Permission ended",
    description:
      "The seller's permission expired or was revoked; this piece is retained for records only.",
    purchaseMode: "none",
  },
};

const FALLBACK: OwnershipWording = {
  label: "Ownership not recorded",
  description:
    "No ownership record is attached, so this piece is shown for reference only and cannot be purchased.",
  purchaseMode: "none",
};

export function ownershipWording(state: string | null): OwnershipWording {
  if (state && state in WORDING) return WORDING[state as OwnershipState];
  return FALLBACK;
}
