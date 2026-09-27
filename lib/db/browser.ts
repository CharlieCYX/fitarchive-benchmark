import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Browser Supabase client (anon key only — safe for the client bundle).
 * Returns null when env vars are absent so callers can render an honest
 * unconfigured state instead of throwing.
 */
export function getBrowserClient(): SupabaseClient | null {
  const { url, anonKey, configured } = getSupabaseEnv();
  if (!configured) return null;
  return createBrowserClient(url as string, anonKey as string);
}
