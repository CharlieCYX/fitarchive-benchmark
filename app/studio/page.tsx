import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/charts/stat-card";
import { STUDIO_SECTIONS } from "./_components/sections";

/**
 * Command Center (§7.1) — Phase 1 shell.
 * Live cards (drop status, permissions awaiting action, failed jobs…) need
 * the catalog/events tables from Phase 2+; until then every card says so
 * plainly instead of showing fabricated counts.
 */
export default function StudioPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl text-ink">Command Center</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        One screen for what needs operator attention: drop status, permissions
        awaiting action, missing data, running experiments, failed jobs. Live
        counts arrive with the catalog and event tables (Phases 2–4) — nothing
        here is hard-coded.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active drop"
          value={null}
          note="Drop tables land in Phase 3."
        />
        <StatCard
          label="Permissions awaiting action"
          value={null}
          note="Permission ledger lands in Phase 2."
        />
        <StatCard
          label="Events today"
          value={null}
          note="Event ingest lands in Phase 4."
        />
      </div>

      <h2 className="mt-12 font-display text-lg text-ink">Studio sections</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {STUDIO_SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="group">
            <Card className="h-full transition-colors group-hover:border-warm-300">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-ink">{section.title}</h3>
                <Badge>{section.phase}</Badge>
              </div>
              <p className="mt-2 text-sm text-warm-700">{section.summary}</p>
              <p className="mt-3 text-xs text-warm-500">Build Bible {section.spec}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
