import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Catalog" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Catalog"
      spec="§7.3"
      phase="Phase 2"
      summary="Product master: condition, measurements, ownership, availability."
    />
  );
}
