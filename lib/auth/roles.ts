/**
 * Role model (DATA_MODEL.md §1 enum `app_role`, ASSUMPTIONS A6).
 * Pure module — safe to import from client or server, and unit-tested.
 * Enforcement always happens server-side; client code only hides UI.
 */

export const APP_ROLES = [
  "owner",
  "seller",
  "shopper",
  "stylist",
  "analyst",
  "viewer",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Owner / operator",
  seller: "Seller",
  shopper: "Shopper",
  stylist: "Stylist",
  analyst: "Analyst",
  viewer: "Viewer",
};

export function isValidRole(value: unknown): value is AppRole {
  return typeof value === "string" && (APP_ROLES as readonly string[]).includes(value);
}

/** Operator Studio (/studio/*) — owner only in V1. */
export function canAccessStudio(role: AppRole): boolean {
  return role === "owner";
}

/** Seller portal (/seller) — sellers see own records; owner can inspect. */
export function canAccessSellerPortal(role: AppRole): boolean {
  return role === "seller" || role === "owner";
}

/** Intelligence dashboards — owner, plus scoped read for analysts (A6). */
export function canReadAnalytics(role: AppRole): boolean {
  return role === "owner" || role === "analyst";
}

/** Shopper Archive (/archive) — any signed-in non-viewer profile. */
export function canAccessArchive(role: AppRole): boolean {
  return role !== "viewer";
}
