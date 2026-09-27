import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Style Engine",
  description:
    "Three deterministic style tools — Build My Fit, Can This Work?, Decode This Reference — with AI narration that never overrides the rules.",
};

const MODES = [
  {
    href: "/style/build",
    name: "Build My Fit",
    spec: "§8.3",
    blurb:
      "Bring 1–3 references (as tags), an occasion, a budget and your rejected silhouettes. Get a style thesis and recommendations that use what you own first — with hard rules on availability, budget and Singapore heat.",
  },
  {
    href: "/style/compatibility",
    name: "Can This Work?",
    spec: "§8.4",
    blurb:
      "Two pieces, seven dimensions — color, silhouette, proportion, material weight, formality, era, energy. Verdict: compatible, tension-but-usable, or contradictory, always with repair moves.",
  },
  {
    href: "/style/decode",
    name: "Decode This Reference",
    spec: "§8.5",
    blurb:
      "Turn a saved look into structure: silhouette, palette, materials and era with confidence and stated uncertainty — then translate it to Singapore and match it against catalog and closet.",
  },
];

/**
 * Style Engine landing (§8.7 Arrival): what the engine is, what it refuses
 * to do, and the three ways in.
 */
export default function StyleLandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16">
      <p className="text-xs uppercase tracking-wide text-warm-500">Style Engine</p>
      <h1 className="mt-2 font-display text-4xl tracking-tight text-ink">
        A style engine disguised as a fashion editorial.
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-warm-700">
        The engine is a set of explicit rules — climate, budget, proportion,
        fabric weight — that always run. An AI layer can re-phrase the
        explanation, but it can never change the decision, invent inventory,
        or claim certainty it hasn&apos;t earned. Every session can be rated,
        and the failures feed the AI Lab.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {MODES.map((mode) => (
          <Link
            key={mode.href}
            href={mode.href}
            className="group rounded-md border border-warm-200 p-5 hover:border-warm-400"
          >
            <p className="text-xs uppercase tracking-wide text-warm-500">{mode.spec}</p>
            <h2 className="mt-1 font-display text-xl text-ink group-hover:text-accent">
              {mode.name}
            </h2>
            <p className="mt-2 text-xs leading-5 text-warm-700">{mode.blurb}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 max-w-2xl text-xs leading-5 text-warm-500">
        Sign in to build around your own closet and save outfits and decisions
        to your <Link href="/archive" className="text-accent hover:text-accent-strong">Archive</Link>.
        Without sign-in the engine still runs — sessions stay anonymous and ephemeral.
      </p>
    </div>
  );
}
