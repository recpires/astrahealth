import type { Metadata } from "next";
import { ResponseView } from "@/components/response/ResponseView";

export const metadata: Metadata = { title: "Response" };

export default function ResponsePage() {
  return <ResponseView />;
}
