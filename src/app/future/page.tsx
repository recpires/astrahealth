import type { Metadata } from "next";
import { OverviewView } from "@/components/future/OverviewView";

export const metadata: Metadata = { title: "Platform preview (FUTURE)" };

export default function FuturePage() {
  return <OverviewView />;
}
