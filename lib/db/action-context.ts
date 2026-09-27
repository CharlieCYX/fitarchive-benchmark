import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireStudioAccess } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { getServerClient } from "@/lib/db/server";

export type OwnerContext =
  | { ok: true; supabase: SupabaseClient; user: SessionUser }
  | { ok: false; error: string };

/**
 * Shared guard for studio server actions (ARCHITECTURE.md §8 rule 2):
 * Supabase configured + authenticated + owner role. Returns a typed failure
 * the action turns into an honest error banner — never a crash.
 */
export async function requireOwnerContext(): Promise<OwnerContext> {
  const supabase = await getServerClient();
  if (!supabase) {
    return {
      ok: false,
      error:
        "Supabase is not configured — this action needs live credentials (see .env.example).",
    };
  }
  const guard = await requireStudioAccess();
  if (!guard.ok) {
    return {
      ok: false,
      error:
        guard.reason === "unauthenticated"
          ? "Sign in with the operator account to make changes."
          : "Owner role required for this action.",
    };
  }
  return { ok: true, supabase, user: guard.user };
}

/** Build a redirect target carrying a single notice or error message. */
export function withMessage(
  path: string,
  kind: "notice" | "error",
  message: string,
): string {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${kind}=${encodeURIComponent(message)}`;
}

/** Flatten a zod error into one readable string for the banner. */
export function zodMessage(error: {
  issues: Array<{ path: PropertyKey[]; message: string }>;
}): string {
  return error.issues
    .map((i) => (i.path.length ? `${String(i.path[0])}: ${i.message}` : i.message))
    .join("; ");
}
