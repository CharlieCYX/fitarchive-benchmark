import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Insights" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Insights"
      spec="§9.2"
      phase="Phase 5"
      summary="Observation → hypothesis → experiment → validated result."
    />
  );
}
