import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Analytics" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Analytics"
      spec="§9.1"
      phase="Phase 5"
      summary="Canonical metrics from first-party events — no hard-coded numbers."
    />
  );
}
