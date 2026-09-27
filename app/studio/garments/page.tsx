import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Garment Lab" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Garment Lab"
      spec="§9.4"
      phase="Phase 8"
      summary="Problem → evidence → ideation → prototype → wear test."
    />
  );
}
