"use client";

import { useState, useTransition } from "react";
import {
  rateGeneration,
  runEvalHarness,
  type EvalHarnessOutcome,
} from "../actions";
import { RATING_DIMENSIONS, RATING_DIMENSION_LABELS, type RatingDimension } from "../ratings";
import type { FailureMode } from "../eval-cases";

/**
 * AI Lab client controls (§13.5): run the §8.8 harness against the active
 * provider, and rate generations on the six review dimensions with
 * failure-mode tags.
 */

const FAILURE_MODES: Array<{ value: FailureMode; label: string }> = [
  { value: "constraint_miss", label: "constraint_miss" },
  { value: "hallucinated_inventory", label: "hallucinated_inventory" },
  { value: "cosplay_overfit", label: "cosplay_overfit" },
  { value: "contradiction_blindness", label: "contradiction_blindness" },
  { value: "unsupported_certainty", label: "unsupported_certainty" },
  { value: "preference_miss", label: "preference_miss" },
];

export function EvalRunner() {
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<EvalHarnessOutcome | null>(null);

  function run() {
    startTransition(async () => {
      setOutcome(await runEvalHarness());
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded-md bg-ink px-4 py-2 text-sm text-white hover:bg-warm-900 disabled:opacity-50"
      >
        {pending ? "Running harness…" : "Run §8.8 evaluation harness"}
      </button>
      <p className="mt-1 text-xs text-warm-500">
        Runs all authored cases against the deterministic engine and probes
        the active provider&apos;s structured-output contract. The run itself is
        logged as an ai_generations row.
      </p>

      {outcome ? (
        <div className="mt-4">
          {!outcome.ok ? (
            <p className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
              {outcome.error}
            </p>
          ) : (
            <>
              <p className="text-sm text-ink">
                {outcome.results?.filter((r) => r.pass).length}/{outcome.results?.length} cases
                passed · provider: {outcome.provider} ·{" "}
                {outcome.providerContract?.ok ? (
                  <span className="text-success">contract OK</span>
                ) : (
                  <span className="text-danger">contract failed</span>
                )}
                {outcome.generationId ? ` · logged as ${outcome.generationId.slice(0, 8)}…` : ""}
              </p>
              <ul className="mt-3 space-y-2">
                {outcome.results?.map((r) => (
                  <li
                    key={r.caseId}
                    className={`rounded-md border p-3 text-sm ${
                      r.pass ? "border-warm-200" : "border-danger/40 bg-danger/5"
                    }`}
                  >
                    <span className={r.pass ? "text-success" : "text-danger"}>
                      {r.pass ? "PASS" : "FAIL"}
                    </span>{" "}
                    <span className="font-medium text-ink">{r.caseId}</span>
                    <p className="mt-0.5 text-xs text-warm-700">{r.engineSummary}</p>
                    {r.violations.map((v, i) => (
                      <p key={i} className="mt-0.5 text-xs text-danger">{v}</p>
                    ))}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function RatingForm({ generationId }: { generationId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [ratings, setRatings] = useState<Record<RatingDimension, number>>({
    grounding: 3,
    constraint_adherence: 3,
    truthfulness: 3,
    utility: 3,
    style_quality: 3,
    reproducibility: 3,
  });
  const [failureModes, setFailureModes] = useState<FailureMode[]>([]);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  function submit(decision: "accepted" | "rejected") {
    startTransition(async () => {
      const result = await rateGeneration({
        generationId,
        ratings,
        failureModes,
        notes,
        decision,
      });
      setMessage(result.ok ? `Marked ${decision} with ratings.` : (result.error ?? "Failed."));
      if (result.ok) setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-accent hover:text-accent-strong"
      >
        rate
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-md border border-warm-200 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {RATING_DIMENSIONS.map((dimension) => (
          <label key={dimension} className="block text-xs text-warm-700">
            {RATING_DIMENSION_LABELS[dimension]}
            <select
              value={ratings[dimension]}
              onChange={(e) =>
                setRatings((prev) => ({ ...prev, [dimension]: Number(e.target.value) }))
              }
              className="mt-1 w-full rounded-md border border-warm-300 bg-white px-2 py-1 text-xs"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <fieldset className="mt-2 text-xs text-warm-700">
        Failure modes
        <div className="mt-1 flex flex-wrap gap-1">
          {FAILURE_MODES.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() =>
                setFailureModes((prev) =>
                  prev.includes(f.value)
                    ? prev.filter((v) => v !== f.value)
                    : [...prev, f.value],
                )
              }
              className={`rounded-full border px-2 py-0.5 ${
                failureModes.includes(f.value)
                  ? "border-danger/50 text-danger"
                  : "border-warm-300 text-warm-700"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Editor notes"
        className="mt-2 w-full rounded-md border border-warm-300 bg-white px-2 py-1 text-xs"
      />
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("accepted")}
          className="rounded-md bg-ink px-3 py-1 text-xs text-white"
        >
          Accept with rating
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => submit("rejected")}
          className="rounded-md border border-danger/40 px-3 py-1 text-xs text-danger"
        >
          Reject with rating
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-2 text-xs text-warm-500">
          cancel
        </button>
      </div>
      {message ? <p className="mt-1 text-xs text-warm-700">{message}</p> : null}
    </div>
  );
}
