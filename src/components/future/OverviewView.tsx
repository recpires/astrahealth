"use client";

import Link from "next/link";
import { ArrowRight, BookHeart, ClipboardCheck, Compass, HeartPulse, ShieldCheck, Stethoscope, type LucideIcon } from "lucide-react";
import { Badge, Panel, buttonClass } from "@/components/ui/primitives";
import { Note } from "@/components/future/common";
import { OutboxPanel } from "@/components/future/OutboxPanel";
import { useTelemetrySnapshot } from "@/components/future/ProfileView";
import { verifyAuditChain } from "@/features/platform/audit";
import { CREW } from "@/features/journal/config";
import { journalFlags, todaysCheckIn } from "@/features/journal/logic";
import { useFuture } from "@/features/platform/FutureProvider";
import { HRR_REFERENCES, HRR_VERIFIED_ON } from "@/features/platform/references";
import { METRICS } from "@/features/profile/config";
import { readinessSummary } from "@/features/readiness/logic";

interface ModuleCard {
  href: string;
  code: string;
  title: string;
  icon: LucideIcon;
  what: string;
  stat: string;
}

const PRINCIPLES = [
  { title: "Offline-first", text: "Every module runs on local data and stores its records on the device. Reports to Earth wait in a queue and go out in priority order when the link returns." },
  { title: "Evidence-based", text: "Scientific context comes only from official NASA Human Research Program sources stored on board, labelled as verified excerpts or reference-only." },
  { title: "Human in the loop", text: "Rules and protocols only propose. The crew medical officer or the commander decides; overriding a proposal needs a written reason." },
  { title: "Traceable", text: "Each decision, evidence shown and action is logged with the rule set version, matched rules and an input checksum in a checksum-chained trail." },
];

export function OverviewView() {
  const { state } = useFuture();
  const telemetry = useTelemetrySnapshot();
  const today = state.platform.clock.day;
  const checkedIn = CREW.filter((c) => todaysCheckIn(state.journal, c.id, today)).length;
  const flags = CREW.reduce((n, c) => n + journalFlags(state.journal, c.id, today).length, 0);
  const pendingReview = state.assess.records.filter((r) => !r.review).length;
  const unavailable = METRICS.filter((m) => m.method === "unavailable").length;
  const readiness = readinessSummary(state, telemetry);
  const chain = verifyAuditChain(state.platform.audit);

  const cards: ModuleCard[] = [
    { href: "/future/journal", code: "F01", title: "Health Journal & Daily Check", icon: BookHeart, what: "Daily self-report, routines, 14-day trends, attention flags.", stat: `${checkedIn}/${CREW.length} checked in today · ${flags} flag(s)` },
    { href: "/future/assess", code: "F02", title: "Symptom Assessment & Evidence Engine", icon: Stethoscope, what: "Structured questions → versioned rules → next steps, evidence and uncertainty.", stat: `${state.assess.records.length} assessment(s) · ${pendingReview} awaiting review` },
    { href: "/future/profile", code: "F03", title: "Extended Health Metrics", icon: HeartPulse, what: "Space Health Profile across 9 domains with origin, quality, trend and validation.", stat: `${METRICS.length} metrics · ${unavailable} need equipment not available (no data)` },
    { href: "/future/eva", code: "F04", title: "EVA & Autonomous Response", icon: ClipboardCheck, what: "Pre/during/post-EVA checklists, equipment-conditioned steps, logged decisions.", stat: state.eva.session ? `${state.eva.session.id} · ${state.eva.session.phase}` : `${state.eva.history.length} EVA(s) closed · none active` },
    { href: "/future/readiness", code: "F05", title: "Verification & Mission Readiness", icon: ShieldCheck, what: "Crew data readiness, system checks, rule-set versions, exportable audit trail.", stat: `${readiness.filter((r) => r.overall === "complete").length}/${CREW.length} crew data complete · trail ${chain.ok ? "intact" : "BROKEN"}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-xl font-semibold text-ink">From a monitoring demo to a space health platform</h1>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Five FUTURE modules extend ASTRA Health into an autonomous space health decision-support system: offline-first, evidence-based and human-in-the-loop. They run beside the
            tested three-scenario demo, with their own state and storage, and only <em>read</em> its simulated vital signs.
          </p>
        </div>
        <Badge tone="caution">Preview · demonstration content</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" data-testid="future-modules">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.href} href={c.href} className="group flex flex-col rounded-xl border border-line bg-space-900/85 p-4 transition-colors hover:border-accent/50">
              <div className="flex items-center gap-2">
                <Icon aria-hidden className="h-4 w-4 text-accent" />
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">{c.code}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-ink">{c.title}</p>
              <p className="mt-1 flex-1 text-xs leading-relaxed text-ink-muted">{c.what}</p>
              <p className="mt-3 text-[11px] text-accent">{c.stat}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs text-ink-faint group-hover:text-ink">
                Open <ArrowRight aria-hidden className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Design principles" icon={Compass} className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {PRINCIPLES.map((p) => (
              <div key={p.title} className="rounded-lg border border-line p-3">
                <p className="text-sm font-semibold text-ink">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{p.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            <Note tone="caution">
              Not a medical device and not clinically validated. Every rule set, checklist and protocol in these modules was written by Team ANGARIS for demonstration, is
              marked PROVISIONAL and is not a NASA procedure. All crew data are simulated or typed in during the demo. Nothing here names a condition, a medication or a treatment.
            </Note>
            <Note>
              Official references on board: {HRR_REFERENCES.length} NASA Human Research Roadmap risks (titles and links checked against the official index on {HRR_VERIFIED_ON}) plus the
              verified evidence library of the Science &amp; Limits section.{" "}
              <Link href="/science" className="text-accent hover:underline">
                Science &amp; Limits
              </Link>
            </Note>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/future/journal" className={buttonClass("primary", "sm")}>
              Start with today&apos;s check-in
            </Link>
            <Link href="/" className={buttonClass("secondary", "sm")}>
              Back to the tested demo
            </Link>
          </div>
        </Panel>
        <OutboxPanel />
      </div>
    </div>
  );
}
