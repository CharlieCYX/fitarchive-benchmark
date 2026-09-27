import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Single-org V1 (ASSUMPTIONS A3): resolve the one FitArchive organization row.
 * Every org-scoped insert needs org_id; there is no org switcher.
 */
export async function getOrgId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}
