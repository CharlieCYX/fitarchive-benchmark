"use client";

import { useState, useTransition } from "react";
import { exportMyData, requestDataRight } from "@/features/account/actions";

/**
 * /settings privacy controls (§15.2): self-service data export (JSON
 * download assembled server-side under RLS) and a data-rights request form
 * (export / deletion) recorded in data_rights_requests. Every failure mode
 * renders an honest message — no dead buttons.
 */
export function PrivacyControls() {
  const [pending, startTransition] = useTransition();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [requestKind, setRequestKind] = useState<"export" | "delete">("delete");
  const [note, setNote] = useState("");
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  function onExport() {
    setExportMessage(null);
    startTransition(async () => {
      const result = await exportMyData();
      if (result.status === "ok") {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        setExportMessage("Download started — your export contains your profile, saves, closet, orders, style sessions and past requests.");
      } else if (result.status === "auth_required") {
        setExportMessage("Sign in to export your data.");
      } else if (result.status === "unconfigured") {
        setExportMessage("Export activates when Supabase is connected.");
      } else {
        setExportMessage(result.message);
      }
    });
  }

  function onRequestSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestMessage(null);
    startTransition(async () => {
      const result = await requestDataRight(requestKind, note);
      if (result.status === "ok") {
        setNote("");
        setRequestMessage(
          requestKind === "delete"
            ? "Deletion request recorded. The operator processes pending requests and will confirm by email; your account stays active until then."
            : "Export request recorded. (You can also download your data instantly above.)",
        );
      } else if (result.status === "auth_required") {
        setRequestMessage("Sign in to file a request.");
      } else if (result.status === "unconfigured") {
        setRequestMessage("Requests activate when Supabase is connected.");
      } else {
        setRequestMessage(result.message);
      }
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wide text-warm-500">
          Export my data
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-700">
          One JSON file with everything tied to your account: profile, saved
          pieces, closet, orders, style sessions and data-rights requests.
          Assembled server-side; row-level security scopes it to you.
        </p>
        <button
          type="button"
          onClick={onExport}
          disabled={pending}
          className="mt-3 rounded-md bg-ink px-5 py-2 text-sm text-white hover:bg-ink-soft disabled:opacity-50"
        >
          Download my data (JSON)
        </button>
        {exportMessage ? (
          <p className="mt-2 text-sm text-warm-700">{exportMessage}</p>
        ) : null}
      </section>

      <section className="border-t border-warm-200 pt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-warm-500">
          Data-rights request
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-warm-700">
          Ask for a full export on record, or for your account and associated
          personal data to be deleted. Requests are stored with a status you
          can see above once processed.
        </p>
        <form onSubmit={onRequestSubmit} className="mt-3 space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 text-warm-700">
              <input
                type="radio"
                name="kind"
                checked={requestKind === "delete"}
                onChange={() => setRequestKind("delete")}
              />
              Delete my data
            </label>
            <label className="flex items-center gap-2 text-warm-700">
              <input
                type="radio"
                name="kind"
                checked={requestKind === "export"}
                onChange={() => setRequestKind("export")}
              />
              Export on record
            </label>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder="Anything we should know? (optional)"
            className="w-full rounded-md border border-warm-300 px-3 py-2 text-sm text-ink"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-warm-300 px-4 py-2 text-sm text-ink hover:border-warm-500 disabled:opacity-50"
          >
            Submit request
          </button>
        </form>
        {requestMessage ? (
          <p className="mt-2 text-sm text-warm-700">{requestMessage}</p>
        ) : null}
      </section>
    </div>
  );
}
