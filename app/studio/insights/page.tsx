import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { getServerClient } from "@/lib/db/server";
import { getOrgId } from "@/lib/db/org";
import { formatDate } from "@/lib/utils";
import { formatRate, formatSampleSize } from "@/lib/metrics/format";
import {
  createInsightAction,
  deleteInsightAction,
  updateInsightAction,
} from "@/features/analytics/actions";
import {
  listDropOptions,
  listInsights,
  listOwnerOptions,
  type InsightRow,
} from "@/features/analytics/insights";
import {
  EVIDENCE_STATE_GUIDANCE,
  EVIDENCE_STATE_LABELS,
  EVIDENCE_STATES,
  FORECAST_DISABLED_REASON,
  type EvidenceState,
} from "@/features/analytics/evidence";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

const STATE_TONES: Record<EvidenceState, "neutral" | "info" | "accent" | "success"> = {
  observation: "neutral",
  hypothesis: "info",
  experiment: "accent",
  validated_result: "success",
};

function InsightForm({
  insight,
  drops,
  owners,
}: {
  insight?: InsightRow;
  drops: Array<{ id: string; name: string }>;
  owners: Array<{ id: string; name: string }>;
}) {
  const editing = Boolean(insight);
  return (
    <Card>
      <CardHeader
        title={editing ? "Edit insight" : "Record an insight"}
        description="Evidence states follow §9.2: observation → hypothesis → experiment → validated result. Language is constrained per state."
      />
      <form
        action={editing ? updateInsightAction : createInsightAction}
        className="grid gap-4"
      >
        {insight ? <input type="hidden" name="id" value={insight.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="type" label="Evidence state" hint={undefined}>
            <>
              <select
                id="type"
                name="type"
                required
                defaultValue={insight?.type ?? "observation"}
                className={inputClass}
              >
                {EVIDENCE_STATES.map((s) => (
                  <option key={s} value={s}>
                    {EVIDENCE_STATE_LABELS[s]}
                  </option>
                ))}
                <option value="forecast" disabled>
                  Forecast — disabled (§9.2)
                </option>
              </select>
              <p className="mt-1 text-xs text-warm-500">{FORECAST_DISABLED_REASON}</p>
            </>
          </FormField>
          <FormField id="title" label="Title">
            <Input
              id="title"
              name="title"
              required
              defaultValue={insight?.title ?? ""}
              placeholder="What was seen / claimed / concluded"
            />
          </FormField>
        </div>
        <FormField
          id="body"
          label="Body"
          hint={EVIDENCE_STATE_GUIDANCE[(insight?.type ?? "observation") as EvidenceState]}
        >
          <textarea
            id="body"
            name="body"
            rows={3}
            defaultValue={insight?.body ?? ""}
            className={inputClass}
            placeholder="State what the data shows — with its sample and its limits."
          />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-4">
          <FormField id="confidence" label="Confidence (0–1)">
            <Input
              id="confidence"
              name="confidence"
              type="number"
              min="0"
              max="1"
              step="0.05"
              defaultValue={insight?.confidence ?? ""}
            />
          </FormField>
          <FormField id="sample_size" label="Sample size">
            <Input
              id="sample_size"
              name="sample_size"
              type="number"
              min="0"
              defaultValue={insight?.sampleSize ?? ""}
            />
          </FormField>
          <FormField id="owner_id" label="Owner">
            <select
              id="owner_id"
              name="owner_id"
              defaultValue={insight?.ownerId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {owners.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="affected_drop_id" label="Affected drop">
            <select
              id="affected_drop_id"
              name="affected_drop_id"
              defaultValue={insight?.affectedDropId ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {drops.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="flex gap-3">
          <Button type="submit">{editing ? "Save changes" : "Record insight"}</Button>
          {editing ? (
            <Button
              type="submit"
              variant="secondary"
              formAction="/studio/insights"
              formMethod="get"
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="Insights"
        spec="§9.2"
        summary="Evidence tracker: observation → hypothesis → experiment → validated result. Forecast stays disabled until a sample threshold and documented methodology exist."
      />
    );
  }

  const params = await searchParams;
  const orgId = await getOrgId(supabase);
  const [insights, drops, owners] = orgId
    ? await Promise.all([
        listInsights(supabase, orgId),
        listDropOptions(supabase),
        listOwnerOptions(supabase),
      ])
    : [[], [], []];

  const filter = (params.type ?? "") as EvidenceState | "";
  const filtered =
    filter && (EVIDENCE_STATES as readonly string[]).includes(filter)
      ? insights.filter((i) => i.type === filter)
      : insights;
  const editing = params.edit ? insights.find((i) => i.id === params.edit) : undefined;

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">Insights</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        The evidence tracker (§9.2). FitArchive tracks what was seen and what
        was validated — it does not forecast. Insights link to drops
        (affected drop) and to drop hypotheses via the Drops module.
      </p>

      <div className="mt-4">
        <MessageBanner searchParams={params} />
      </div>

      <div className="mt-6">
        <InsightForm insight={editing} drops={drops} owners={owners} />
      </div>

      <form className="mt-8 flex items-end gap-3" method="get">
        <FormField id="f-type" label="Filter by state">
          <select id="f-type" name="type" defaultValue={filter} className={inputClass}>
            <option value="">All</option>
            {EVIDENCE_STATES.map((s) => (
              <option key={s} value={s}>
                {EVIDENCE_STATE_LABELS[s]}
              </option>
            ))}
          </select>
        </FormField>
        <Button type="submit" variant="secondary">
          Filter
        </Button>
      </form>

      {filtered.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No insights yet"
          description="Record the first observation from the research inbox or a dashboard chart. Insights move through evidence states — nothing here is a forecast."
        />
      ) : (
        <ul className="mt-6 space-y-3">
          {filtered.map((i) => (
            <li key={i.id} className="rounded-lg border border-warm-200 bg-white p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={STATE_TONES[i.type]}>{EVIDENCE_STATE_LABELS[i.type]}</Badge>
                <h3 className="font-medium text-ink">{i.title}</h3>
              </div>
              {i.body ? <p className="mt-2 text-sm text-warm-700">{i.body}</p> : null}
              <p className="mt-2 text-xs text-warm-500">
                {i.ownerName ?? "Unassigned"} · {formatDate(i.createdAt)}
                {i.confidence !== null ? ` · confidence ${formatRate(i.confidence, 0)}` : ""}
                {i.sampleSize !== null ? ` · ${formatSampleSize(i.sampleSize)}` : ""}
                {i.affectedDropName ? ` · affects ${i.affectedDropName}` : ""}
              </p>
              <div className="mt-3 flex gap-2">
                <form method="get">
                  <input type="hidden" name="edit" value={i.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Edit
                  </Button>
                </form>
                <form action={deleteInsightAction}>
                  <input type="hidden" name="id" value={i.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
