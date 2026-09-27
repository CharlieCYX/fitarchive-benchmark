import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Server Supabase client bound to the request cookie store (session-aware,
 * RLS applies as the calling user). Returns null when env vars are absent.
 * cookies() is only touched when configured, so unconfigured demo builds
 * stay statically renderable.
 */
export async function getServerClient(): Promise<SupabaseClient | null> {
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) return null;

  const cookieStore = await cookies();
  return createServerClient(url as string, anonKey as string, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component — cookie writes are ignored there;
          // session refresh happens in route handlers / server actions.
        }
      },
    },
  });
}
