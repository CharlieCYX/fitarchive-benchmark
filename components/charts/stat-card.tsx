import { Card } from "@/components/ui/card";

/**
 * Presentational stat card for metric-layer-backed dashboards.
 * IMPORTANT (rule §6.4/§8.4): `value` must come from lib/metrics (canonical
 * SQL views). When a metric has no data yet, pass value=null and this renders
 * an honest "no data" state instead of a fabricated zero.
 */
export function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number | null;
  note?: string;
}) {
  return (
    <Card>
      <p className="text-xs uppercase tracking-wide text-warm-500">{label}</p>
      <p className="mt-2 font-display text-2xl text-ink">
        {value === null ? <span className="text-warm-500">No data yet</span> : value}
      </p>
      {note ? <p className="mt-1 text-xs text-warm-500">{note}</p> : null}
    </Card>
  );
}
