import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Research Inbox" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Research Inbox"
      spec="§7.2"
      phase="Phase 2"
      summary="Manual marketplace capture, duplicate detection, drop-candidate flags."
    />
  );
}
