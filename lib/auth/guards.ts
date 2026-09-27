import "server-only";
import { getSessionUser, type SessionUser } from "./session";
import { canAccessStudio, type AppRole } from "./roles";

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "unauthenticated" | "forbidden"; user: SessionUser | null };

/**
 * Server-side authorization guard. `allow` receives the session role and
 * returns whether access is granted. Use in layouts/pages/server actions;
 * render the honest state for the failure reason (never a dead end).
 */
export async function authorize(
  allow: (role: AppRole) => boolean,
): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, reason: "unauthenticated", user: null };
  if (!allow(user.role)) return { ok: false, reason: "forbidden", user };
  return { ok: true, user };
}

/** Convenience guard for the operator Studio. */
export async function requireStudioAccess(): Promise<GuardResult> {
  return authorize(canAccessStudio);
}
