import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Honest "Planned in Phase X" state for studio sections that are not built
 * yet (Build Bible: unfinished modules acceptable if labeled honestly).
 */
export function SectionPlaceholder({
  title,
  spec,
  phase,
  summary,
}: {
  title: string;
  spec: string;
  phase: string;
  summary: string;
}) {
  return (
    <div className="max-w-3xl">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-2xl text-ink">{title}</h1>
        <Badge tone="accent">Planned — {phase}</Badge>
      </div>
      <p className="mt-1 text-xs uppercase tracking-wide text-warm-500">
        Build Bible {spec}
      </p>
      <EmptyState
        className="mt-8"
        title={`${title} ships in ${phase}`}
        description={`${summary} This module is on the roadmap and not built yet — nothing here is a stub pretending to work. See docs/IMPLEMENTATION_PLAN.md for the phase contract.`}
      />
    </div>
  );
}
