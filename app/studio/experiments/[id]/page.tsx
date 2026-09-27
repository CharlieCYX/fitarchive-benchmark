import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import {
  concludeExperimentAction,
  transitionExperimentAction,
} from "@/features/analytics/actions";
import { getExperiment } from "@/features/analytics/experiments";
import {
  CONCLUSION_STRENGTH_LABELS,
  CONCLUSION_STRENGTHS,
  canTransition,
  type ExperimentStatus,
} from "@/features/analytics/evidence";
import { MessageBanner } from "../../_components/message-banner";
import { UnconfiguredState } from "../../_components/unconfigured";

export const metadata: Metadata = { title: "Experiment detail" };
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

/** Buttons for every legal next status (state machine in features/analytics/evidence). */
function StatusActions({ id, status }: { id: string; status: ExperimentStatus }) {
  const targets = (["running", "paused", "concluded", "abandoned"] as const).filter((t) =>
    canTransition(status, t),
  );
  if (targets.length === 0) {
    return <p className="text-sm text-warm-500">Terminal state — no further transitions.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {targets
        .filter((t) => t !== "concluded")
        .map((t) => (
          <form key={t} action={transitionExperimentAction}>
            <input type="hidden" name="experiment_id" value={id} />
            <input type="hidden" name="to_status" value={t} />
            <Button type="submit" variant={t === "abandoned" ? "ghost" : "secondary"} size="sm">
              {t === "running" && status === "paused"
                ? "Resume"
                : t === "running"
                  ? "Start"
                  : t === "paused"
                    ? "Pause"
                    : "Abandon"}
            </Button>
          </form>
        ))}
      {targets.includes("concluded") ? (
        <p className="w-full text-xs text-warm-500">
          To conclude, write the conclusion below — concluding requires it.
        </p>
      ) : null}
    </div>
  );
}

export default async function ExperimentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Experiment detail"
        spec="§12.4"
        summary="Experiment lifecycle: draft → running → paused → concluded/abandoned, with written conclusions."
      />
    );
  }

  const [{ id }, bannerParams] = await Promise.all([params, searchParams]);
  const experiment = await getExperiment(supabase, id);
  if (!experiment) notFound();

  const running = experiment.status === "running" || experiment.status === "paused";

  return (
    <div className="max-w-4xl">
      <Link href="/studio/experiments" className="text-sm text-warm-500 hover:text-ink">
        ← Experiments
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl text-ink">{experiment.name}</h1>
        <Badge tone={STATUS_TONES[experiment.status]}>{experiment.status}</Badge>
        {experiment.conclusionStrength ? (
          <Badge tone="info">{CONCLUSION_STRENGTH_LABELS[experiment.conclusionStrength]}</Badge>
        ) : null}
      </div>

      <div className="mt-4">
        <MessageBanner searchParams={bannerParams} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Design (§12.4)" />
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-warm-500">Hypothesis</dt>
            <dd className="mt-0.5 text-ink">{experiment.hypothesis}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Primary metric</dt>
            <dd className="mt-0.5 font-mono text-xs text-ink">{experiment.primaryMetric}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Guardrail metrics</dt>
            <dd className="mt-0.5 font-mono text-xs text-ink">
              {experiment.guardrailMetrics.length > 0 ? experiment.guardrailMetrics.join(", ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Unit of assignment</dt>
            <dd className="mt-0.5 text-ink">{experiment.unitOfAssignment}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-warm-500">Window</dt>
            <dd className="mt-0.5 text-ink">
              {experiment.startAt ? formatDate(experiment.startAt) : "—"} →{" "}
              {experiment.endAt ? formatDate(experiment.endAt) : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-warm-500">Sample target / rationale</dt>
            <dd className="mt-0.5 text-ink">{experiment.sampleTargetOrRationale ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-warm-500">Confounders</dt>
            <dd className="mt-0.5 text-ink">{experiment.confoundersNotes ?? "—"}</dd>
          </div>
        </dl>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-warm-200 p-3">
            <p className="text-sm font-medium text-ink">A · {experiment.variantA.label ?? "control"}</p>
            {experiment.variantA.notes ? (
              <p className="mt-1 text-xs text-warm-700">{experiment.variantA.notes}</p>
            ) : null}
          </div>
          <div className="rounded-md border border-warm-200 p-3">
            <p className="text-sm font-medium text-ink">B · {experiment.variantB.label ?? "treatment"}</p>
            {experiment.variantB.notes ? (
              <p className="mt-1 text-xs text-warm-700">{experiment.variantB.notes}</p>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Status" description="Legal transitions only; concluded and abandoned are terminal." />
        <StatusActions id={experiment.id} status={experiment.status} />
      </Card>

      {experiment.assignments.length > 0 ? (
        <Card className="mt-6">
          <CardHeader
            title="Assignments"
            description={`${experiment.assignments.length} ${experiment.unitOfAssignment} units assigned.`}
          />
          <Table>
            <THead>
              <TR>
                <TH>Unit</TH>
                <TH>Variant</TH>
                <TH>Assigned</TH>
              </TR>
            </THead>
            <TBody>
              {experiment.assignments.map((a) => (
                <TR key={`${a.unitKey}-${a.variant}`}>
                  <TD className="font-mono text-xs">{a.unitKey}</TD>
                  <TD>{a.variant}</TD>
                  <TD className="text-warm-500">{formatDate(a.assignedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : null}

      {experiment.conclusion ? (
        <Card className="mt-6">
          <CardHeader title="Conclusion" />
          <p className="text-sm text-ink">{experiment.conclusion}</p>
          <p className="mt-2 text-xs text-warm-500">
            Strength: {experiment.conclusionStrength ? CONCLUSION_STRENGTH_LABELS[experiment.conclusionStrength] : "—"}
          </p>
        </Card>
      ) : null}

      {running ? (
        <Card className="mt-6 mb-10">
          <CardHeader
            title="Conclude"
            description="State what the data showed and how strong the evidence is. Inconclusive is a legitimate outcome."
          />
          <form action={concludeExperimentAction} className="grid gap-4">
            <input type="hidden" name="experiment_id" value={experiment.id} />
            <FormField id="conclusion" label="Conclusion">
              <textarea
                id="conclusion"
                name="conclusion"
                required
                rows={3}
                className={inputClass}
                placeholder="What did the primary metric do, what did guardrails do, and within what sample?"
              />
            </FormField>
            <FormField id="conclusion_strength" label="Conclusion strength">
              <select id="conclusion_strength" name="conclusion_strength" required className={inputClass}>
                {CONCLUSION_STRENGTHS.map((s) => (
                  <option key={s} value={s}>
                    {CONCLUSION_STRENGTH_LABELS[s]}
                  </option>
                ))}
              </select>
            </FormField>
            <div>
              <Button type="submit">Conclude experiment</Button>
            </div>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
