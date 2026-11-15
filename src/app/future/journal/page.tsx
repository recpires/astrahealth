import type { Metadata } from "next";
import { JournalView } from "@/components/future/JournalView";

export const metadata: Metadata = { title: "F01 · Health Journal" };

export default function JournalPage() {
  return <JournalView />;
}
