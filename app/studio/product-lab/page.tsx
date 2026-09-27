import type { Metadata } from "next";
import { SectionPlaceholder } from "../_components/section-placeholder";

export const metadata: Metadata = { title: "Product Lab" };

export default function StudioPage() {
  return (
    <SectionPlaceholder
      title="Product Lab"
      spec="§9.5"
      phase="Phase 8"
      summary="Problem briefs, PRDs, prototype tests, postmortems."
    />
  );
}
