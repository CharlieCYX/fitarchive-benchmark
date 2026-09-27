"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/events/track";
import type { EventName } from "@/lib/validation/events";

/**
 * Fires a single dictionary event on mount (drop_view, product_view, …).
 * Fire-and-forget; renders nothing.
 */
export function TrackEvent({
  event,
  properties,
}: {
  event: EventName;
  properties: Record<string, unknown>;
}) {
  const fired = useRef(false);
  const key = JSON.stringify(properties);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void trackEvent(event, JSON.parse(key) as Record<string, unknown>);
    // key captures properties by value; event/key identity is what matters.
  }, [event, key]);

  return null;
}

/**
 * Fires one `product_impression` per rendered grid item (position = the
 * item's index in the rendered, filtered grid).
 */
export function TrackImpressions({
  items,
}: {
  items: Array<{ product_id: string; drop_id: string | null }>;
}) {
  const key = JSON.stringify(items);

  useEffect(() => {
    const list = JSON.parse(key) as Array<{
      product_id: string;
      drop_id: string | null;
    }>;
    for (const [position, item] of list.entries()) {
      void trackEvent("product_impression", { ...item, position });
    }
  }, [key]);

  return null;
}
