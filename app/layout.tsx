import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FitArchive",
    template: "%s — FitArchive",
  },
  description:
    "FitArchive turns overlooked secondhand fashion into structured market intelligence, curated drops and measurable commerce — with the evidence trail behind every decision.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
