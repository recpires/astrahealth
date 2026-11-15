import type { ReactNode } from "react";
import { FutureShell } from "@/components/future/FutureShell";

export default function FutureLayout({ children }: { children: ReactNode }) {
  return <FutureShell>{children}</FutureShell>;
}
