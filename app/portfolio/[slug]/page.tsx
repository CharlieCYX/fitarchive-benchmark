import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { getServerClient } from "@/lib/db/server";
import { isSupabaseConfigured } from "@/lib/env";
import { formatDate } from "@/lib/utils";
import { ROLE_LENS_LABELS, isRoleLens } from "@/features/portfolio/lens";
import { EVIDENCE_STAGE_LABELS } from "@/features/portfolio/evidence-graph";
import { frozenPayloadSchema } from "@/features/portfolio/snapshot";
import { getPublicSnapshotBySlug } from "@/features/portfolio/service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await getServerClient();
  if (!supabase) return { title: "Case study" };
  const snapshot = await getPublicSnapshotBySlug(supabase, slug);
  return { title: snapshot ? snapshot.payload.title : "Case study" };
}

/**
 * /portfolio/[slug] — public case study (§21).
 *
 * Reads ONLY frozen portfolio_snapshots rows (§6.4 rule 8): later edits to
 * products, metrics or the project never rewrite what is published here.
 * The payload was stripped to the §21.2 allowlist at freeze time, so buyer
 * contacts, seller private notes, cost basis and internal financials can
 * never appear (§15.2).
 */
export default async function PortfolioCaseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Portfolio case study</h1>
        <EmptyState
          className="mt-8"
          title="Connect Supabase to view case studies"
          description="Portfolio case studies render from frozen snapshots only (§6.4 rule 8). Configure Supabase (see .env.example), apply the migrations and seed, then publish a snapshot from /studio/portfolio."
        />
        <p className="mt-6 text-xs text-warm-500">
          <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
        </p>
      </div>
    );
  }

  const supabase = await getServerClient();
  const snapshot = supabase ? await getPublicSnapshotBySlug(supabase, slug) : null;

  if (!snapshot) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-2xl text-ink">Portfolio case study</h1>
        <EmptyState
          className="mt-8"
          title={`No published case study at “${slug}”`}
          description="Case studies appear here only after the operator freezes and publishes a snapshot. Frozen snapshots are never rewritten by later edits."
        />
        <p className="mt-6 text-xs text-warm-500">
          <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
        </p>
      </div>
    );
  }

  const parsed = frozenPayloadSchema.safeParse(snapshot.payload);
  if (!parsed.success) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          title="This snapshot failed schema validation"
          description="The stored payload does not match the §21.2 snapshot schema. It has not been modified; regenerate a new version from /studio/portfolio."
        />
      </div>
    );
  }
  const p = parsed.data;

  return (
    <article className="mx-auto max-w-3xl px-6 py-16 print:py-8">
      <header>
        <p className="text-xs uppercase tracking-wide text-warm-500">
          Case study · {isRoleLens(p.role_lens) ? ROLE_LENS_LABELS[p.role_lens] : p.role_lens}
        </p>
        <h1 className="mt-2 font-display text-3xl text-ink">{p.title}</h1>
        {p.one_line_problem ? (
          <p className="mt-3 text-lg text-warm-700">{p.one_line_problem}</p>
        ) : null}
        <p className="mt-2 text-xs text-warm-500">
          Frozen snapshot v{snapshot.version} · published {formatDate(snapshot.published_at)} ·
          later edits do not change this page
        </p>
      </header>

      <dl className="mt-8 grid gap-6 border-t border-warm-200 pt-8 sm:grid-cols-2">
        {p.contribution ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Contribution</dt>
            <dd className="mt-1 text-sm text-ink">{p.contribution}</dd>
          </div>
        ) : null}
        {p.context_constraints ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Context & constraints</dt>
            <dd className="mt-1 text-sm text-ink">{p.context_constraints}</dd>
          </div>
        ) : null}
      </dl>

      {p.evidence_graph.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Evidence chain</h2>
          <ol className="mt-4 space-y-3">
            {p.evidence_graph.map((link, i) => (
              <li key={i} className="flex items-baseline gap-3 text-sm">
                <Badge tone="accent">{EVIDENCE_STAGE_LABELS[link.stage]}</Badge>
                <span className="text-ink">{link.label}</span>
                {link.href && link.href.startsWith("http") ? (
                  <a href={link.href} target="_blank" rel="noreferrer" className="text-xs text-accent hover:text-accent-strong">
                    source ↗
                  </a>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {p.evidence_summary ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Evidence & data</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-warm-700">{p.evidence_summary}</p>
        </section>
      ) : null}

      {p.decision ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Decision</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-warm-700">{p.decision}</p>
        </section>
      ) : null}

      {p.result_metrics.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Results</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {p.result_metrics.map((m, i) => (
              <li key={i} className="rounded-md border border-warm-200 p-4">
                <p className="text-xs uppercase tracking-wide text-warm-500">{m.label}</p>
                <p className="mt-1 font-display text-2xl text-ink">
                  {m.value}
                  {m.unit ? <span className="ml-1 text-sm text-warm-500">{m.unit}</span> : null}
                </p>
                <p className="mt-1 text-xs text-warm-500">
                  {m.period}
                  {m.sample_size !== null ? ` · n=${m.sample_size}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.what_changed_next ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">What changed next</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-warm-700">{p.what_changed_next}</p>
        </section>
      ) : null}

      {p.limitations ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Limitations</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-warm-700">{p.limitations}</p>
        </section>
      ) : null}

      {p.links.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-display text-xl text-ink">Links</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {p.links.map((url, i) => (
              <li key={i}>
                <a href={url} target="_blank" rel="noreferrer" className="text-accent hover:text-accent-strong">
                  {url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.ko_draft ? (
        <section className="mt-10 rounded-md border border-warm-200 p-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg text-ink">한국어</h2>
            {p.ko_machine_assisted ? (
              <Badge tone="warning">machine-assisted draft — pending human review</Badge>
            ) : (
              <Badge tone="success">human-reviewed</Badge>
            )}
          </div>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-warm-700">{p.ko_draft}</p>
        </section>
      ) : null}

      <footer className="mt-12 border-t border-warm-200 pt-6 text-xs text-warm-500">
        <p>
          Rendered from frozen snapshot {snapshot.slug} — source data may have evolved since;
          this page intentionally does not follow it.
        </p>
        <p className="mt-2">
          <Link href="/" className="hover:text-ink">← Back to FitArchive</Link>
        </p>
      </footer>
    </article>
  );
}
