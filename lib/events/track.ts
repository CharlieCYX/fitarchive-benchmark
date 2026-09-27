"use client";

import type { EventName } from "@/lib/validation/events";
import { parseAttribution } from "./attribution";

/**
 * Client event tracker (EVENTS_AND_METRICS.md §1). Fire-and-forget: failures
 * are swallowed (debug-logged) and never break the page. Identity is
 * pseudonymous — the server sets/reads the `fa_sid` cookie; this helper
 * never sends user identity.
 *
 * `trackEvent` uses fetch with `keepalive` so the returned promise resolves
 * to the inserted event id when the server provides one (needed for
 * search_submit → search_result_click linkage); `trackBeacon` uses
 * navigator.sendBeacon for pagehide-class signals where no response is
 * readable.
 */

export interface TrackOptions {
  /** Extra envelope fields (route/referrer default to the current page). */
  route?: string;
  referrer?: string | null;
}

function newClientEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Last-resort fallback (non-secure contexts); still a valid uuid shape.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function buildEnvelope(
  eventName: EventName,
  properties: Record<string, unknown>,
  opts: TrackOptions,
): Record<string, unknown> {
  const route =
    opts.route ??
    (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : null);
  const referrer =
    opts.referrer !== undefined
      ? opts.referrer
      : typeof document !== "undefined" && document.referrer
        ? document.referrer
        : null;
  const props = { ...properties };
  if (eventName === "page_view" && typeof window !== "undefined") {
    Object.assign(
      props,
      parseAttribution(new URLSearchParams(window.location.search)),
    );
  }
  return {
    event_name: eventName,
    client_event_id: newClientEventId(),
    occurred_at: new Date().toISOString(),
    route,
    referrer,
    properties: props,
  };
}

/** Fire-and-forget event POST. Resolves to the event id when available. */
export async function trackEvent(
  eventName: EventName,
  properties: Record<string, unknown>,
  opts: TrackOptions = {},
): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildEnvelope(eventName, properties, opts)),
      keepalive: true,
    });
    if (!res.ok) {
      console.debug(`[track] ${eventName} rejected: HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as {
      id?: string | null;
    } | null;
    return data?.id ?? null;
  } catch (err) {
    console.debug(`[track] ${eventName} failed`, err);
    return null;
  }
}

/** sendBeacon variant for unload-time signals (no response readable). */
export function trackBeacon(
  eventName: EventName,
  properties: Record<string, unknown>,
  opts: TrackOptions = {},
): void {
  if (typeof navigator === "undefined" || !("sendBeacon" in navigator)) {
    void trackEvent(eventName, properties, opts);
    return;
  }
  try {
    const blob = new Blob(
      [JSON.stringify(buildEnvelope(eventName, properties, opts))],
      { type: "application/json" },
    );
    navigator.sendBeacon("/api/events", blob);
  } catch (err) {
    console.debug(`[track] beacon ${eventName} failed`, err);
  }
}
