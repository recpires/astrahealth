import type { Metadata } from "next";
import { ReadinessView } from "@/components/future/ReadinessView";

export const metadata: Metadata = { title: "F05 · Readiness & Trace" };

export default function ReadinessPage() {
  return <ReadinessView />;
}
