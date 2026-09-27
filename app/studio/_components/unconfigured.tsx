import { EmptyState } from "@/components/ui/empty-state";

/**
 * Unconfigured-mode state for studio modules (§7.x): renders the section
 * structure with a clear "Connect Supabase" explanation — never a crash,
 * never fake data presented as real.
 */
export function UnconfiguredState({
  title,
  spec,
  summary,
}: {
  title: string;
  spec: string;
  summary: string;
}) {
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-2xl text-ink">{title}</h1>
      <p className="mt-1 text-xs uppercase tracking-wide text-warm-500">
        Build Bible {spec}
      </p>
      <p className="mt-2 text-sm text-warm-700">{summary}</p>
      <EmptyState
        className="mt-8"
        title="Connect Supabase to use this module"
        description="This module is fully implemented and reads/writes live data. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example), apply the migrations and seed, then sign in as the owner. No demo numbers are shown here — the interface activates against real data only."
      />
    </div>
  );
}
