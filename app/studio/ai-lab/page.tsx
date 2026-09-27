import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { getServerClient } from "@/lib/db/server";
import { formatDate } from "@/lib/utils";
import { PROMPT_REGISTRY } from "@/lib/ai/prompts";
import { EVAL_CASES } from "@/features/ai/eval-cases";
import {
  generationStats,
  listGenerations,
  listPromptVersions,
} from "@/features/ai/service";
import { setGenerationStatus } from "@/features/ai/actions";
import { EvalRunner, RatingForm } from "@/features/ai/components/ai-lab-controls";
import { MessageBanner } from "../_components/message-banner";
import { UnconfiguredState } from "../_components/unconfigured";

export const metadata: Metadata = { title: "AI Lab" };
export const dynamic = "force-dynamic";

const STATUS_TONES: Record<string, "neutral" | "success" | "danger" | "warning"> = {
  draft: "warning",
  accepted: "success",
  rejected: "danger",
  superseded: "neutral",
};

export default async function AiLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const supabase = await getServerClient();
  if (!supabase) {
    return (
      <UnconfiguredState
        title="AI Lab"
        spec="§13.5"
        summary="Prompt versions, generation provenance, and the §8.8 evaluation harness with human rating dimensions."
      />
    );
  }

  const params = await searchParams;
  const [promptVersions, generations, stats] = await Promise.all([
    listPromptVersions(supabase),
    listGenerations(supabase),
    generationStats(supabase),
  ]);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl text-ink">AI Lab</h1>
      <p className="mt-2 max-w-2xl text-sm text-warm-700">
        §13.5 — governance and evaluation for every AI feature. Rules:
        AI output is a draft until a human accepts it, raw responses never
        leave this surface, and the default provider is the deterministic
        mock — the system is fully functional without paid AI (§17.3).
      </p>

      <MessageBanner searchParams={params} />

      {/* stats */}
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wide text-warm-500">Generations</p>
          <p className="mt-1 font-display text-2xl text-ink">{stats.total}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-warm-500">By status</p>
          <p className="mt-1 text-sm text-warm-700">
            {Object.entries(stats.byStatus)
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ") || "—"}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-warm-500">Flagged</p>
          <p className="mt-1 font-display text-2xl text-ink">{stats.flagged}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wide text-warm-500">Features in use</p>
          <p className="mt-1 text-sm text-warm-700">{stats.features.length}</p>
        </Card>
      </div>

      {/* eval harness */}
      <Card className="mt-6">
        <CardHeader
          title={`Evaluation harness (${EVAL_CASES.length} cases)`}
          description="§8.8 authored cases with expected constraints — run against the deterministic engine plus a structured-output contract probe on the active provider."
        />
        <ul className="mb-4 grid gap-2 text-xs text-warm-700 sm:grid-cols-2">
          {EVAL_CASES.map((c) => (
            <li key={c.id} className="rounded-md border border-warm-200 p-2">
              <span className="font-medium text-ink">{c.title}</span>{" "}
              <Badge tone="neutral">{c.failureModeTested}</Badge>
              <p className="mt-1">{c.description}</p>
            </li>
          ))}
        </ul>
        <EvalRunner />
      </Card>

      {/* prompt versions */}
      <Card className="mt-6">
        <CardHeader
          title={`Prompt versions (${promptVersions.length} rows)`}
          description="FitArchive owns its prompts (§13.3); the registry in lib/ai/prompts.ts is the source of truth and is seeded into ai_prompt_versions."
        />
        {promptVersions.length === 0 ? (
          <p className="text-xs text-warm-500">
            No rows — apply the seed. The registry defines {PROMPT_REGISTRY.length} prompt(s).
          </p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Feature</TH>
                <TH>Version</TH>
                <TH>System prompt</TH>
                <TH>Created</TH>
              </TR>
            </THead>
            <TBody>
              {promptVersions.map((pv) => (
                <TR key={pv.id}>
                  <TD className="font-mono text-xs">{pv.feature}</TD>
                  <TD>v{pv.version}</TD>
                  <TD className="max-w-md truncate text-xs text-warm-700">{pv.system_prompt}</TD>
                  <TD className="text-xs">{formatDate(pv.created_at)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* provenance browser */}
      <Card className="mt-6">
        <CardHeader
          title={`Provenance browser (${generations.length} recent)`}
          description="Every ai_generations row: provider, model, prompt version, status, flags. Raw responses stay private (§20.3)."
        />
        {generations.length === 0 ? (
          <p className="text-xs text-warm-500">No generations yet — run the harness or a style session.</p>
        ) : (
          <ul className="space-y-3">
            {generations.map((gen) => (
              <li key={gen.id} className="rounded-md border border-warm-200 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono text-ink">{gen.feature}</span>
                  <Badge tone="neutral">{gen.provider}/{gen.model}</Badge>
                  {gen.prompt_version !== null ? (
                    <Badge tone="info">prompt v{gen.prompt_version}</Badge>
                  ) : null}
                  <Badge tone={STATUS_TONES[gen.status] ?? "neutral"}>{gen.status}</Badge>
                  {gen.disclosure_required ? <Badge tone="warning">disclosure required</Badge> : null}
                  {gen.flags.map((f) => (
                    <Badge key={f} tone="danger">{f}</Badge>
                  ))}
                  <span className="text-warm-500">{formatDate(gen.created_at)}</span>
                </div>
                {gen.output_preview ? (
                  <p className="mt-1 text-xs text-warm-700">{gen.output_preview}{gen.output_preview.length >= 160 ? "…" : ""}</p>
                ) : null}
                {gen.human_editor_notes ? (
                  <p className="mt-1 text-xs text-warm-500">Editor: {gen.human_editor_notes.slice(0, 200)}</p>
                ) : null}
                <div className="mt-2 flex items-center gap-3">
                  <form action={setGenerationStatus} className="flex gap-1">
                    <input type="hidden" name="generation_id" value={gen.id} />
                    {gen.status !== "accepted" ? (
                      <button type="submit" name="status" value="accepted" className="text-xs text-success hover:underline">
                        accept
                      </button>
                    ) : null}
                    {gen.status !== "rejected" ? (
                      <button type="submit" name="status" value="rejected" className="text-xs text-danger hover:underline">
                        reject
                      </button>
                    ) : null}
                  </form>
                  <RatingForm generationId={gen.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
