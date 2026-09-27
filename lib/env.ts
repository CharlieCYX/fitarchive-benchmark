/**
 * Environment presence helpers. The app must boot and render an honest
 * "unconfigured" state when Supabase env vars are absent (demo shell mode)
 * instead of crashing.
 */
export interface SupabaseEnv {
  url: string | undefined;
  anonKey: string | undefined;
  configured: boolean;
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return { url, anonKey, configured: Boolean(url && anonKey) };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().configured;
}
