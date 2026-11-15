"use client";

import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { Badge, cx } from "@/components/ui/primitives";
import type { ToneName } from "@/components/ui/levels";
import { CREW } from "@/features/journal/config";
import type { CrewId } from "@/features/journal/types";
import { useFuture } from "@/features/platform/FutureProvider";
import { EVIDENCE_LEVEL_TEXT, evidenceLevel, referenceById, type EvidenceLevel } from "@/features/platform/references";
import type { LinkPriority, OutboxState } from "@/features/platform/types";

export const PRIORITY_TONE: Record<LinkPriority, ToneName> = { urgent: "warning", priority: "caution", routine: "neutral" };
export const OUTBOX_TONE: Record<OutboxState, ToneName> = { queued: "neutral", sent: "accent", delivered: "advisory", acknowledged: "nominal" };
export const OUTBOX_TEXT: Record<OutboxState, string> = {
  queued: "Waiting to send",
  sent: "Sent",
  delivered: "Received on Earth",
  acknowledged: "Acknowledged",
};
export const EVIDENCE_TONE: Record<EvidenceLevel, ToneName> = { "verified-excerpts": "nominal", "reference-only": "caution" };

export function CrewPicker({ label = "Crew member" }: { label?: string }) {
  const { crewId, setCrewId } = useFuture();
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{label}</span>
      {CREW.map((c) => (
        <button
          key={c.id}
          type="button"
          data-testid={`crew-${c.id}`}
          aria-pressed={crewId === c.id}
          onClick={() => setCrewId(c.id as CrewId)}
          className={cx(
            "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
            crewId === c.id ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
          )}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  testId,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  testId?: string;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-xs font-medium text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1" data-testid={testId}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cx(
              "cursor-pointer rounded-md border px-2.5 py-1 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              value === o.value ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-ink-muted hover:text-ink",
            )}
          >
            <input type="radio" className="sr-only" name={label} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-space-950/60 px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/50";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-ink-muted">{label}</span>
      {children}
      {hint && <span className="mt-0.5 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export function Note({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "caution" }) {
  return (
    <p
      className={cx(
        "rounded-lg border border-dashed px-3 py-2 text-[11px] leading-relaxed",
        tone === "caution" ? "border-level-caution/40 text-level-caution/90" : "border-line text-ink-faint",
      )}
    >
      {children}
    </p>
  );
}

export function ReferenceLink({ refId, compact }: { refId: string; compact?: boolean }) {
  const ref = referenceById(refId);
  if (!ref) return null;
  const level = evidenceLevel(ref);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      <a href={ref.url} target="_blank" rel="noreferrer" className="flex min-w-0 max-w-full items-center gap-1 text-accent hover:underline">
        <span className={cx("min-w-0", compact && "line-clamp-1")}>{compact ? `NASA HRR · ${ref.title}` : ref.title}</span>
        <ExternalLink aria-hidden className="h-3 w-3 shrink-0" />
      </a>
      <Badge tone={EVIDENCE_TONE[level]}>{EVIDENCE_LEVEL_TEXT[level]}</Badge>
    </span>
  );
}

export function SourceTag({ source }: { source: "demo-seed" | "crew-entry" }) {
  return <Badge tone={source === "demo-seed" ? "neutral" : "accent"}>{source === "demo-seed" ? "Demo seed" : "Crew entry"}</Badge>;
}
