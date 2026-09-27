"use client";

import { useState, useTransition } from "react";
import { submitStyleFeedback } from "../actions";
import { FAILURE_MODE_OPTIONS, FEEDBACK_LABELS } from "../taxonomy-options";

/**
 * Shared style-engine client helpers: the API call, the §8.3 feedback
 * control and small display primitives. Kept separate from the forms so all
 * three modes wire events + feedback identically.
 */

export interface StyleApiResponse {
  ok: boolean;
  error?: string;
  mode?: string;
  result?: Record<string, unknown>;
  style_session_id?: string | null;
  persisted?: boolean;
  provider?: string;
  model?: string;
}

/** Create a session (best-effort) then run the engine. */
export async function runStyleRequest(
  mode: string,
  payload: Record<string, unknown>,
): Promise<StyleApiResponse> {
  let styleSessionId: string | null = null;
  try {
    const sessionRes = await fetch("/api/style/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode, inputs: {} }),
    });
    if (sessionRes.ok) {
      const data = (await sessionRes.json()) as { style_session_id?: string | null };
      styleSessionId = data.style_session_id ?? null;
    }
  } catch {
    // session creation is best-effort — generation works without it
  }

  const res = await fetch("/api/style/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, mode, style_session_id: styleSessionId }),
  });
  const data = (await res.json()) as StyleApiResponse;
  if (!res.ok) {
    return { ok: false, error: data.error ?? `Request failed (HTTP ${res.status}).` };
  }
  return data;
}

/** §8.3 feedback control — writes style_feedback with failure-mode tags. */
export function FeedbackPanel({ styleSessionId }: { styleSessionId: string | null }) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [failureMode, setFailureMode] = useState<string>("");
  const [note, setNote] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!styleSessionId) {
    return (
      <p className="mt-6 rounded-md border border-warm-200 bg-warm-50 p-3 text-xs text-warm-700">
        Feedback activates when Supabase is connected (the session must persist
        before it can be rated).
      </p>
    );
  }

  if (done) {
    return (
      <p className="mt-6 rounded-md border border-warm-200 bg-warm-50 p-3 text-sm text-ink">
        Feedback recorded — {done}. It feeds the style_feedback_success metric
        and the AI Lab failure-mode review.
      </p>
    );
  }

  function submit(label: string) {
    setSelected(label);
    setError(null);
    startTransition(async () => {
      const needsNote = label === "other" && !note.trim();
      if (needsNote) {
        setError("Tell us what was off — one line is enough.");
        return;
      }
      const result = await submitStyleFeedback({
        styleSessionId: styleSessionId as string,
        label,
        failureMode: failureMode || null,
        note,
      });
      if (result.status === "ok") setDone(label);
      else setError(result.status === "error" ? result.message : "Feedback unavailable right now.");
    });
  }

  return (
    <div className="mt-6 rounded-md border border-warm-200 p-4">
      <p className="text-sm font-medium text-ink">Did this land?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {FEEDBACK_LABELS.map((l) => (
          <button
            key={l.value}
            type="button"
            disabled={pending}
            onClick={() => submit(l.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              selected === l.value
                ? "border-accent text-accent"
                : "border-warm-300 text-warm-700 hover:border-warm-500"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <select
          value={failureMode}
          onChange={(e) => setFailureMode(e.target.value)}
          className="rounded-md border border-warm-300 bg-white px-2 py-1.5 text-xs text-ink"
        >
          <option value="">Failure mode (optional, §8.8)</option>
          {FAILURE_MODE_OPTIONS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="rounded-md border border-warm-300 bg-white px-2 py-1.5 text-xs text-ink"
        />
      </div>
      {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
    </div>
  );
}

/** Small labeled chip list used across the three result views. */
export function ChipRow({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div className="mt-2">
      <span className="text-xs uppercase tracking-wide text-warm-500">{label}</span>
      <span className="ml-2 inline-flex flex-wrap gap-1">
        {values.map((v) => (
          <span
            key={v}
            className="rounded-full border border-warm-300 px-2 py-0.5 text-xs text-warm-700"
          >
            {v}
          </span>
        ))}
      </span>
    </div>
  );
}

export const inputClass =
  "w-full rounded-md border border-warm-300 bg-white px-3 py-2 text-sm text-ink";

export function LabeledSelect({
  id,
  label,
  value,
  onChange,
  options,
  allowEmpty = "—",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[] | ReadonlyArray<{ value: string; label: string }>;
  allowEmpty?: string | null;
}) {
  return (
    <label htmlFor={id} className="block text-xs font-medium text-warm-700">
      {label}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} mt-1`}
      >
        {allowEmpty !== null ? <option value="">{allowEmpty}</option> : null}
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ),
        )}
      </select>
    </label>
  );
}
