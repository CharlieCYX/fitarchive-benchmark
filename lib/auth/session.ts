import "server-only";
import { getServerClient } from "@/lib/db/server";
import { isValidRole, type AppRole } from "./roles";

export interface SessionUser {
  id: string;
  email: string | null;
  role: AppRole;
}

/**
 * Resolve the current session user (server-side). Returns null when
 * Supabase is unconfigured (demo shell mode) or nobody is signed in.
 * Role comes from `profiles.role` and defaults to `shopper` per A1/A6 —
 * never trusted from client-supplied values.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await getServerClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role: AppRole = isValidRole(profile?.role) ? profile.role : "shopper";
  return { id: user.id, email: user.email ?? null, role };
}
