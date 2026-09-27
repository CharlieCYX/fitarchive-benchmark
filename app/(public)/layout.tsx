import type { ReactNode } from "react";
import { SiteFooter } from "@/components/editorial/site-footer";
import { SiteHeader } from "@/components/editorial/site-header";
import { PageViewTracker } from "@/components/editorial/page-view-tracker";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageViewTracker />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
