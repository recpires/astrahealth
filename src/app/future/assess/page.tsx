import type { Metadata } from "next";
import { AssessView } from "@/components/future/AssessView";

export const metadata: Metadata = { title: "F02 · Symptom Assessment" };

export default function AssessPage() {
  return <AssessView />;
}
