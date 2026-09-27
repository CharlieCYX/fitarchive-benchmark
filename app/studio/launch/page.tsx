import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Launch Control" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Launch Control"
      spec="§7.7"
      phase="Phase 3"
      summary="Publish gate, live traffic, incidents, rollback."
    />
  );
}
