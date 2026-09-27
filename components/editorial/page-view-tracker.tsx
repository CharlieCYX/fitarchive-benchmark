"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/events/track";

/**
 * Fires `page_view` on every public route change (EVENTS §1). Attribution
 * (campaign + utm_*) is merged in by the tracker from the current URL.
 * Fire-and-forget: never blocks rendering.
 */
export function PageViewTracker() {
  const pathname = usePathname();
  const last = useRef<string | null>(null);

  useEffect(() => {
    const route = pathname + window.location.search;
    if (last.current === route) return;
    last.current = route;
    void trackEvent("page_view", {});
  }, [pathname]);

  return null;
}
