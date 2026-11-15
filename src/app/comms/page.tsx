import type { Metadata } from "next";
import { CommsView } from "@/components/comms/CommsView";

export const metadata: Metadata = { title: "Earth Link" };

export default function CommsPage() {
  return <CommsView />;
}
