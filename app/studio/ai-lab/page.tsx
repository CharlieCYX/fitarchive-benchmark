import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "AI Lab" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="AI Lab"
      spec="§13.5"
      phase="Phase 7"
      summary="Prompt versions, generation provenance, evaluation harness."
    />
  );
}
