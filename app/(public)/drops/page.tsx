import type { Metadata } from "next";
import Link from "next/link";
import { getServerClient } from "@/lib/db/server";
import { listPublishedDrops } from "@/features/storefront/service";
import { ConnectSupabaseNotice } from "@/components/editorial/connect-supabase";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Drop archive",
  description: "Every published FitArchive drop — concept, story and pieces.",
};

/**
 * /drops — drop archive (§8.1). Published drops only; planning/scheduled
 * drops never appear here.
 */
export default async function DropsArchivePage() {
  const supabase = await getServerClient();
  if (!supabase) return <ConnectSupabaseNotice section="The drop archive" />;

  const drops = await listPublishedDrops(supabase);

  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-[0.2em] text-warm-500">
        Drop archive
      </p>
      <h1 className="mt-4 font-display text-4xl text-ink">Every drop, kept.</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-warm-700">
        Small curated releases with a concept and a hypothesis. Sold pieces stay
        visible — the archive is the evidence trail.
      </p>

      {drops.length === 0 ? (
        <EmptyState
          className="mt-12"
          title="No published drops yet"
          description="Drop #001 is still moving through the readiness gate (permissions, measurements, media rights). When it passes, it appears here automatically."
        />
      ) : (
        <ol className="mt-12 space-y-px overflow-hidden rounded-lg border border-warm-200">
          {drops.map((drop) => (
            <li key={drop.id}>
              <Link
                href={`/drops/${drop.slug}`}
                className="flex flex-wrap items-baseline justify-between gap-3 bg-white px-6 py-6 transition-colors hover:bg-warm-100/60"
              >
                <div>
                  <h2 className="font-display text-2xl text-ink">{drop.name}</h2>
                  {drop.concept ? (
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-warm-700">
                      {drop.concept}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-xs text-warm-500">
                  <p>{drop.item_count} pieces</p>
                  <p className="mt-1">Published {formatDate(drop.published_at)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
