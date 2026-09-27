import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Portfolio" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Portfolio"
      spec="§21"
      phase="Phase 9"
      summary="Role-lensed case studies from frozen snapshots."
    />
  );
}
