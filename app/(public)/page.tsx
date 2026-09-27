import Link from "next/link";
import { Badge } from "@/components/ui/badge";

/**
 * Public landing / current drop (route map §23.1: `/`).
 * Phase 1: explains the venture honestly. No fake stats, no dead CTAs —
 * the storefront routes (/drops, /products/[slug], /search) land in Phase 4
 * and are named as such, not linked.
 */
export default function LandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6">
      {/* Hero */}
      <section className="py-16 md:py-24">
        <p className="text-xs uppercase tracking-[0.2em] text-warm-500">
          Circular fashion, run like a discipline
        </p>
        <h1 className="mt-4 max-w-2xl font-display text-4xl leading-tight text-ink md:text-5xl">
          Overlooked fashion, taken seriously.
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-warm-700">
          FitArchive finds overlooked secondhand pieces, documents them properly —
          condition, measurements, provenance, permission — and releases them as
          small curated drops. Every decision, from sourcing to pricing, leaves an
          evidence trail you can inspect.
        </p>
      </section>

      {/* Current drop — honest placeholder */}
      <section className="border-t border-warm-200 py-16">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-ink">The current drop</h2>
          <Badge tone="accent">In preparation</Badge>
        </div>
        <div className="mt-8 rounded-lg border border-dashed border-warm-300 bg-warm-100/50 px-6 py-12">
          <h3 className="font-display text-lg text-ink">Drop #001 is being curated</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-warm-700">
            The first drop is still in research and sourcing: pieces are being
            observed, sellers contacted, and permissions documented before anything
            is published. The public storefront — drop archive, product pages and
            search (<span className="text-ink">/drops</span>,{" "}
            <span className="text-ink">/products</span>,{" "}
            <span className="text-ink">/search</span>) — arrives in Phase 4 of the
            build, with real inventory and real numbers. Nothing here is mocked up
            to look further along than it is.
          </p>
        </div>
      </section>

      {/* Operating loop */}
      <section className="border-t border-warm-200 py-16">
        <h2 className="font-display text-2xl text-ink">How it works</h2>
        <ol className="mt-8 grid gap-px overflow-hidden rounded-lg border border-warm-200 bg-warm-200 md:grid-cols-4">
          {[
            {
              step: "01",
              title: "Research",
              body: "Listings observed by hand across secondhand platforms — no scraping, no invented feeds. Duplicates caught by normalized URL.",
            },
            {
              step: "02",
              title: "Curate",
              body: "Pieces are qualified, sellers give documented permission, and condition plus measurements are recorded before pricing.",
            },
            {
              step: "03",
              title: "Launch",
              body: "Small drops with a concept, entry/core/hero tiers, and a readiness gate that blocks publishing when permissions or data are missing.",
            },
            {
              step: "04",
              title: "Measure",
              body: "First-party events feed canonical metrics — the same definitions on every dashboard. Findings become the next drop's hypothesis.",
            },
          ].map((item) => (
            <li key={item.step} className="bg-white p-6">
              <p className="text-xs text-warm-500">{item.step}</p>
              <h3 className="mt-2 font-display text-lg text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warm-700">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Access */}
      <section className="border-t border-warm-200 py-16">
        <h2 className="font-display text-2xl text-ink">Access</h2>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-warm-700">
          Operators work in the Studio; sellers see their own items, permissions and
          settlements in the portal. Sign-in is a passwordless email link.
        </p>
        <div className="mt-6 flex gap-4 text-sm">
          <Link href="/login" className="text-accent hover:text-accent-strong">
            Sign in with email →
          </Link>
          <Link href="/studio" className="text-warm-700 hover:text-ink">
            Operator Studio →
          </Link>
        </div>
      </section>
    </div>
  );
}
