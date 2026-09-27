import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatSgd } from "@/lib/utils";
import { formatRate } from "@/lib/metrics/format";
import {
  attachDecisionCard,
  captureDashboardSnapshot,
} from "@/features/analytics/actions";
import type { InsightRow } from "@/features/analytics/insights";
import type { SnapshotListRow } from "@/features/analytics/metric-service";
import { DASHBOARD_CHART_REFS } from "./panels";

const selectClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

/**
 * Decision cards (§9.1): a written decision + owner + date + confidence
 * attached to any chart on this dashboard. Stored on insights.
 */
export function DecisionCards({
  decisions,
  drops,
  owners,
}: {
  decisions: InsightRow[];
  drops: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Attach a decision card"
          description="Every decision anchored to a chart gets a written decision, an owner, a date and a confidence. Stored as an insight (§9.1 → §9.2)."
        />
        <form action={attachDecisionCard} className="grid gap-4">
          <FormField id="chart_ref" label="Chart">
            <select id="chart_ref" name="chart_ref" required className={selectClass}>
              {DASHBOARD_CHART_REFS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="decision" label="Decision">
            <textarea
              id="decision"
              name="decision"
              required
              rows={3}
              placeholder="e.g. Keep Drop #002 ladder weighted to entry band; no >SGD 100 pieces until inquiry rate on premium improves."
              className={selectClass}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField id="owner_id" label="Owner">
              <select id="owner_id" name="owner_id" className={selectClass}>
                <option value="">—</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField id="confidence" label="Confidence (0–1)">
              <Input id="confidence" name="confidence" type="number" min="0" max="1" step="0.05" />
            </FormField>
            <FormField id="affected_drop_id" label="Affected drop">
              <select id="affected_drop_id" name="affected_drop_id" className={selectClass}>
                <option value="">—</option>
                {drops.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <div>
            <Button type="submit">Attach decision</Button>
          </div>
        </form>
      </Card>
      <Card>
        <CardHeader
          title="Decision log"
          description="Decisions recorded against charts on this dashboard (newest first)."
        />
        {decisions.length === 0 ? (
          <p className="text-sm text-warm-500">
            No decisions attached yet. The first decision card will appear here with its
            owner, date and confidence.
          </p>
        ) : (
          <ul className="space-y-3 text-sm">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-md border border-warm-200 p-3">
                <Badge tone="accent">{d.title.replace(/^Decision — /, "")}</Badge>
                <p className="mt-1 text-warm-700">{d.body}</p>
                <p className="mt-2 text-xs text-warm-500">
                  {d.ownerName ?? "Unassigned"} · {formatDate(d.createdAt)}
                  {d.confidence !== null ? ` · confidence ${formatRate(d.confidence, 0)}` : ""}
                  {d.affectedDropName ? ` · affects ${d.affectedDropName}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/**
 * Dashboard version snapshots (§9.1): freeze current canonical metric values
 * into metric_snapshots for portfolio freezing later.
 */
export function SnapshotPanel({ snapshots }: { snapshots: SnapshotListRow[] }) {
  return (
    <Card>
      <CardHeader
        title="Dashboard version snapshots"
        description="Freeze the current canonical metric values into metric_snapshots. Portfolio case studies pin these rows, so a frozen number never silently changes."
      />
      <form action={captureDashboardSnapshot}>
        <Button type="submit" variant="secondary">
          Capture snapshot now
        </Button>
      </form>
      {snapshots.length > 0 ? (
        <Table className="mt-4">
          <THead>
            <TR>
              <TH>Metric</TH>
              <TH>Scope</TH>
              <TH>Value</TH>
              <TH>n</TH>
              <TH>Captured</TH>
            </TR>
          </THead>
          <TBody>
            {snapshots.map((s) => (
              <TR key={s.id}>
                <TD className="font-medium">{s.metricKey}</TD>
                <TD className="text-xs text-warm-500">
                  {Object.keys(s.scope).length === 0
                    ? "org-wide"
                    : Object.entries(s.scope)
                        .map(([k, v]) => `${k}: ${String(v).slice(0, 8)}`)
                        .join(", ")}
                </TD>
                <TD>
                  {s.value === null
                    ? "—"
                    : s.metricKey === "gmv" || s.metricKey === "fitarchive_contribution"
                      ? formatSgd(s.value)
                      : s.metricKey === "time_to_sale"
                        ? `${s.value.toFixed(1)} days`
                        : formatRate(s.value)}
                </TD>
                <TD>{s.sampleSize ?? "—"}</TD>
                <TD className="text-warm-500">{formatDate(s.capturedAt)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      ) : (
        <p className="mt-3 text-sm text-warm-500">No snapshots captured yet.</p>
      )}
    </Card>
  );
}
