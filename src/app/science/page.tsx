import type { Metadata } from "next";
import { ScienceView } from "@/components/science/ScienceView";

export const metadata: Metadata = { title: "Science & Limits" };

export default function SciencePage() {
  return <ScienceView />;
}
