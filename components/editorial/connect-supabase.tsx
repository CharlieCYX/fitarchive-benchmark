import { EmptyState } from "@/components/ui/empty-state";

/**
 * Public-surface "Connect Supabase" notice — same honesty contract as the
 * studio unconfigured state, worded for visitors. Rendered whenever env vars
 * are absent; never fake catalog data.
 */
export function ConnectSupabaseNotice({ section }: { section: string }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <EmptyState
        title={`${section} activates when Supabase is connected`}
        description="This storefront reads only real, published rows from the database — no mock catalog is shown. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example), apply the migrations and demo seed, and this page renders the live archive."
      />
    </div>
  );
}
