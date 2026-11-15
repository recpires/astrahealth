import type { Metadata } from "next";
import { EvaView } from "@/components/future/EvaView";

export const metadata: Metadata = { title: "F04 · EVA & Response" };

export default function EvaPage() {
  return <EvaView />;
}
