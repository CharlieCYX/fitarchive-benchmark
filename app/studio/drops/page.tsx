import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Drops" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Drops"
      spec="§7.5"
      phase="Phase 3"
      summary="Drop builder: tiers, price ladder, readiness gate, hypotheses."
    />
  );
}
