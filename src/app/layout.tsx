import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { MissionProvider } from "@/state/MissionProvider";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: {
    default: "ASTRA Health — Autonomous Space Health Response Assistant",
    template: "%s · ASTRA Health",
  },
  description:
    "Demonstration MVP by Team ANGARIS (NASA Space Apps Challenge 2026): MEASURE → UNDERSTAND → ACT → COMMUNICATE for long-duration space missions. Simulated data only; not a medical device.",
};

export const viewport: Viewport = {
  themeColor: "#030817",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <MissionProvider>
          <AppShell>{children}</AppShell>
        </MissionProvider>
      </body>
    </html>
  );
}
