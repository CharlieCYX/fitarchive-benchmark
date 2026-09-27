import type { ReactNode } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { formatSampleSize } from "@/lib/metrics/format";

export interface ChartRow {
  label: string;
  /** Formatted display value (already through a lib/metrics formatter). */
  display: string;
}

/**
 * Chart frame (§12.3 / §9.1 discipline): every chart ships with a visible
 * title, a sample-size note, and an equivalent data table (screen-reader
 * table plus a no-JS <details> toggle). Empty data renders an honest empty
 * state — never a fake chart.
 */
export function ChartFrame({
  title,
  description,
  sampleSize,
  note,
  headers = ["Label", "Value"],
  rows,
  children,
  emptyTitle = "No data yet",
  emptyDescription = "This chart fills in once the underlying events exist. No placeholder numbers are shown.",
}: {
  title: string;
  description?: string;
  /** Total sample behind the numbers (events / items / sessions). */
  sampleSize?: number | null;
  /** Extra honesty note (identity basis, denominator, guardrail…). */
  note?: string;
  headers?: [string, string] | [string, string, string];
  /** Rows mirroring the chart values for the accessible table. */
  rows: ChartRow[];
  children: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const empty = rows.length === 0;
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-warm-500">
          {sampleSize !== undefined ? <span>{formatSampleSize(sampleSize)}</span> : null}
          {note ? <span>{note}</span> : null}
        </div>
        {empty ? (
          <div className="rounded-md border border-dashed border-warm-300 bg-warm-100/50 px-4 py-8 text-center">
            <p className="text-sm font-medium text-ink">{emptyTitle}</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-warm-500">{emptyDescription}</p>
          </div>
        ) : (
          <>
            <div aria-hidden="true">{children}</div>
            {/* Screen-reader equivalent */}
            <table className="sr-only">
              <caption>{title}</caption>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    <td>{r.display}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* No-JS visible alternative */}
            <details className="text-xs">
              <summary className="cursor-pointer text-warm-500 underline decoration-dotted underline-offset-2 hover:text-ink">
                View as table
              </summary>
              <table className="mt-2 w-full border-collapse text-left text-xs text-ink">
                <thead className="border-b border-warm-200 text-warm-500">
                  <tr>
                    {headers.map((h) => (
                      <th key={h} scope="col" className="py-1 pr-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-warm-200">
                  {rows.map((r) => (
                    <tr key={r.label}>
                      <th scope="row" className="py-1 pr-3 font-normal">
                        {r.label}
                      </th>
                      <td className="py-1">{r.display}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        )}
      </div>
    </Card>
  );
}
