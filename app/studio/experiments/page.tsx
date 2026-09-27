import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServerClient } from "@/lib/db/server";
import { getOrgId } from "@/lib/db/org";
import { METRIC_KEYS } from "@/lib/metrics";
import { formatDate } from "@/lib/utils";
import { createExperimentAction } from "@/features/analytics/actions";
import { listExperiments } from "@/features/analytics/experiments";
import {
  CONCLUSION_STRENGTH_LABELS,
  EXPERIMENT_UNITS,
  type ExperimentStatus,
} from "@/features/analytics/evidence";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Experiments" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

const STATUS_TONES: Record<ExperimentStatus, "neutral" | "accent" | "warning" | "success" | "danger"> = {
  draft: "neutral",
  running: "accent",
  paused: "warning",
  concluded: "success",
  abandoned: "danger",
};

export default async function ExperimentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Experiments"
        spec="§12.4"
        summary="Structured experiments: hypothesis, primary + guardrail metrics, unit of assignment, variants, sample rationale, confounders, status lifecycle and written conclusions."
      />
    );
  }

  const params = await searchParams;
  const orgId = await getOrgId(supabase);
  const experiments = orgId ? await listExperiments(supabase, orgId) : [];

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">Experiments</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        The §12.4 experiment object, end to end: hypothesis → variants →
        running → concluded with a strength label (inconclusive / directional /
        repeated evidence). Metrics are canonical keys from metric_definitions.
      </p>

      <div className="mt-4">
        <MessageBanner searchParams={params} />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Draft an experiment"
          description="Drafts stay un-started until both variants are live; conclusions require a written statement and a strength label."
        />
        <form action={createExperimentAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="name" label="Name">
              <Input id="name" name="name" required placeholder="Drop #002 price-ladder shift" />
            </FormField>
            <FormField id="unit_of_assignment" label="Unit of assignment">
              <select id="unit_of_assignment" name="unit_of_assignment" required className={inputClass}>
                {EXPERIMENT_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField id="hypothesis" label="Hypothesis">
            <textarea
              id="hypothesis"
              name="hypothesis"
              required
              rows={2}
              className={inputClass}
              placeholder="Testable claim + what result would support or refute it."
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="primary_metric" label="Primary metric">
              <select id="primary_metric" name="primary_metric" required className={inputClass}>
                {METRIC_KEYS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              id="guardrail_metrics"
              label="Guardrail metrics"
              hint="Comma-separated canonical metric keys (max 5)."
            >
              <Input id="guardrail_metrics" name="guardrail_metrics" placeholder="inquiry_rate, save_rate" />
            </FormField>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-md border border-warm-200 p-3">
              <p className="text-sm font-medium text-ink">Variant A (control)</p>
              <FormField id="variant_a_label" label="Label">
                <Input id="variant_a_label" name="variant_a_label" required placeholder="Current ladder" />
              </FormField>
              <FormField id="variant_a_notes" label="Notes">
                <Input id="variant_a_notes" name="variant_a_notes" placeholder="12 items, 25% entry" />
              </FormField>
            </div>
            <div className="space-y-3 rounded-md border border-warm-200 p-3">
              <p className="text-sm font-medium text-ink">Variant B (treatment)</p>
              <FormField id="variant_b_label" label="Label">
                <Input id="variant_b_label" name="variant_b_label" required placeholder="Entry-weighted ladder" />
              </FormField>
              <FormField id="variant_b_notes" label="Notes">
                <Input id="variant_b_notes" name="variant_b_notes" placeholder="16 items, 45% entry" />
              </FormField>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="start_at" label="Start (optional)">
              <Input id="start_at" name="start_at" type="datetime-local" />
            </FormField>
            <FormField id="end_at" label="End (optional)">
              <Input id="end_at" name="end_at" type="datetime-local" />
            </FormField>
          </div>
          <FormField id="sample_target_or_rationale" label="Sample target or rationale">
            <Input
              id="sample_target_or_rationale"
              name="sample_target_or_rationale"
              placeholder="e.g. One full drop cycle; single-drop traffic means directional reads only."
            />
          </FormField>
          <FormField id="confounders_notes" label="Confounders">
            <Input
              id="confounders_notes"
              name="confounders_notes"
              placeholder="e.g. Payday weekend overlaps launch; IG feature uncontrolled."
            />
          </FormField>
          <div>
            <Button type="submit">Create draft</Button>
          </div>
        </form>
      </Card>

      {experiments.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No experiments yet"
          description="Draft the first experiment above. The five Drop #002 seed drafts (§12.5) appear here once the seed is applied."
        />
      ) : (
        <Table className="mt-6">
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Primary metric</TH>
              <TH>Status</TH>
              <TH>Window</TH>
              <TH>Conclusion</TH>
            </TR>
          </THead>
          <TBody>
            {experiments.map((e) => (
              <TR key={e.id}>
                <TD>
                  <Link
                    href={`/studio/experiments/${e.id}`}
                    className="font-medium text-accent hover:text-accent-strong"
                  >
                    {e.name}
                  </Link>
                </TD>
                <TD className="font-mono text-xs">{e.primaryMetric}</TD>
                <TD>
                  <Badge tone={STATUS_TONES[e.status]}>{e.status}</Badge>
                </TD>
                <TD className="text-warm-500">
                  {e.startAt ? formatDate(e.startAt) : "—"} → {e.endAt ? formatDate(e.endAt) : "—"}
                </TD>
                <TD>
                  {e.conclusionStrength ? (
                    <Badge tone="info">{CONCLUSION_STRENGTH_LABELS[e.conclusionStrength]}</Badge>
                  ) : (
                    "—"
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
