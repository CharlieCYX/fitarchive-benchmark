import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Campaigns" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Campaigns"
      spec="§7.6"
      phase="Phase 3"
      summary="Briefs, channel plan, tracked links, AI copy as suggestion."
    />
  );
}
