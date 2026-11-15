"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, FileSearch, Gauge, History, ListTree, ScanLine } from "lucide-react";
import { REFERENCE_CONFIG } from "@/config/reference-ranges";
import { formatMET } from "@/lib/time";
import { VITAL_KEYS, type AnalysisEvent, type Finding, type RuleId } from "@/lib/types";
import { useMission } from "@/state/MissionProvider";
import { Badge, EmptyState, Panel, ProgressBar, cx } from "@/components/ui/primitives";
import { CATEGORY_TEXT, CATEGORY_TONE, LEVEL_TEXT, LEVEL_TONE, TONES, type ToneName } from "@/components/ui/levels";

export const RULES: { id: RuleId; name: string; description: string }[] = [
  {
    id: "VITAL_OUT_OF_RANGE",
    name: "Range check with persistence",
    description: `Reports a deviation after ${REFERENCE_CONFIG.persistenceSamples} consecutive readings outside the demo reference range; clears after ${REFERENCE_CONFIG.persistenceSamples} consecutive readings back inside.`,
  },
  { id: "SENSOR_DROPOUT", name: "Dropout detection", description: `Counts missing readings in the last ${REFERENCE_CONFIG.sensorLookbackSamples} samples.` },
  { id: "SENSOR_IMPLAUSIBLE", name: "Plausibility limits", description: "Flags values a working sensor should never report." },
  { id: "SENSOR_ABRUPT_CHANGE", name: "Rate-of-change check", description: "Flags jumps between consecutive readings larger than the configured maximum step." },
  { id: "SENSOR_LOW_QUALITY", name: "Signal quality", description: `Flags mean signal quality below ${REFERENCE_CONFIG.degradedQuality * 100} % (poor below ${REFERENCE_CONFIG.poorQuality * 100} %).` },
  { id: "SENSOR_FLATLINE", name: "Frozen value", description: "Flags a heart-rate value that stays exactly identical for 2 minutes." },
  {
    id: "READING_INCONSISTENT",
    name: "Cross-check",
    description: "An out-of-range value coming from a suspect sensor is reported as inconsistent and requires crew confirmation instead of being treated as a vital-sign change.",
  },
];

function FindingCard({ finding, since }: { finding: Finding; since?: number }) {
  const tone = LEVEL_TONE[finding.level];
  return (
    <article className={cx("rounded-lg border bg-space-850/70 p-4", TONES[tone].border)} data-testid={`finding-${finding.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{LEVEL_TEXT[finding.level]}</Badge>
        <Badge tone={CATEGORY_TONE[finding.category]}>{CATEGORY_TEXT[finding.category]}</Badge>
        {finding.needsConfirmation && <Badge tone="sensor">Confirmation needed</Badge>}
        {since !== undefined && <span className="ml-auto tabular font-mono text-[11px] text-ink-faint">since {formatMET(since)}</span>}
      </div>
      <h3 className="mt-2 text-base font-semibold text-ink">{finding.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{finding.explanation}</p>
      <p className="mt-2 rounded-md border border-line bg-space-950/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-ink-faint">
        <span className="text-ink-muted">Evidence · </span>
        {finding.evidence}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">Rule {finding.ruleId}</p>
    </article>
  );
}

const EVENT_TONE: Record<AnalysisEvent["type"], ToneName> = {
  detected: "caution",
  escalated: "warning",
  "de-escalated": "advisory",
  cleared: "nominal",
  system: "accent",
};

export function EventTable({ events, limit }: { events: AnalysisEvent[]; limit?: number }) {
  const rows = [...events].reverse().slice(0, limit);
  if (rows.length === 0) return <EmptyState>No events yet.</EmptyState>;
  return (
    <div className="max-h-[420px] overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-space-900 text-[10px] uppercase tracking-[0.14em] text-ink-faint">
          <tr>
            <th className="py-2 pr-3 font-semibold">MET</th>
            <th className="py-2 pr-3 font-semibold">Event</th>
            <th className="py-2 pr-3 font-semibold">Level</th>
            <th className="py-2 font-semibold">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-t border-line/60 align-top">
              <td className="tabular py-2 pr-3 font-mono text-xs text-ink-muted">{formatMET(e.t)}</td>
              <td className="py-2 pr-3">
                <Badge tone={e.category === "sensor-issue" && e.type === "detected" ? "sensor" : EVENT_TONE[e.type]}>{e.type}</Badge>
              </td>
              <td className={cx("py-2 pr-3 text-xs font-semibold", TONES[LEVEL_TONE[e.level]].text)}>{LEVEL_TEXT[e.level]}</td>
              <td className="py-2">
                <p className="text-ink">{e.title}</p>
                <p className="text-xs text-ink-faint">{e.detail}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalysisView() {
  const { state, view } = useMission();
  const e = view.effective;
  const tone = LEVEL_TONE[e.level];
  const firedRules = new Set(state.analysis.findings.map((f) => f.ruleId));
  const relTone: ToneName = e.reliability.label === "High" ? "nominal" : e.reliability.label === "Medium" ? "caution" : "warning";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">02 · Understand</p>
          <h1 className="text-2xl font-semibold text-ink">Intelligent analysis</h1>
        </div>
        <p className="max-w-xl text-xs text-ink-faint">
          Deterministic rules compare simulated readings with <strong className="text-level-caution">provisional</strong> demo
          reference ranges. The output is an attention level, not a diagnosis, and has no clinical validation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title="Attention level" eyebrow="Current assessment" icon={ScanLine} tone={tone} className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className={cx("grid h-24 w-40 shrink-0 place-items-center rounded-xl border-2", TONES[tone].border, TONES[tone].bg)}>
              <p className={cx("text-2xl font-bold tracking-[0.12em]", TONES[tone].text)} data-testid="analysis-level">
                {e.level}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-base text-ink">{e.summary}</p>
              <p className="mt-2 text-xs text-ink-faint">
                Levels: NOMINAL → ADVISORY (be aware) → CAUTION (check / follow checklist) → WARNING (request support). Sensor issues are
                shown in violet so they are never confused with a change in the body.
              </p>
              {e.findings.length > 0 && (
                <Link href="/response" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                  Go to response procedures <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </Panel>

        <Panel title="Data reliability" eyebrow="Can the readings be trusted?" icon={Gauge} tone={relTone}>
          <div className="flex items-baseline gap-2">
            <p className={cx("text-3xl font-bold", TONES[relTone].text)} data-testid="reliability-label">
              {e.reliability.label}
            </p>
            <p className="tabular font-mono text-sm text-ink-muted">{e.reliability.score}%</p>
          </div>
          <ul className="mt-3 space-y-2">
            {VITAL_KEYS.map((k) => {
              const score = e.reliability.perVital[k];
              const vc = REFERENCE_CONFIG.vitals[k];
              return (
                <li key={k} className="flex items-center gap-3">
                  <span className="w-12 text-[11px] text-ink-faint">{vc.shortLabel}</span>
                  {score === undefined ? (
                    <span className="text-[11px] text-level-sensor">excluded</span>
                  ) : (
                    <>
                      <ProgressBar value={score / 100} tone={score >= 80 ? "nominal" : score >= 55 ? "caution" : "warning"} label={`${vc.shortLabel} reliability`} />
                      <span className="tabular w-9 text-right font-mono text-[11px] text-ink-muted">{score}%</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-ink-muted">
            {e.reliability.factors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-ink-faint">Reliability describes data quality, not certainty about the crew member&apos;s health.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Panel title={`Findings (${e.findings.length})`} eyebrow="Explained in plain language" icon={FileSearch} className="xl:col-span-2">
          {e.findings.length === 0 ? (
            <EmptyState>No findings — all simulated readings are within the demo reference ranges and the sensors look reliable.</EmptyState>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {e.findings.map((f) => (
                <FindingCard key={f.id} finding={f} since={state.openedAt[f.id]} />
              ))}
            </div>
          )}
          {e.resolved.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-level-nominal">
                <CheckCircle2 className="h-4 w-4" /> Resolved by crew confirmation
              </h3>
              <ul className="space-y-1.5">
                {e.resolved.map((r) => (
                  <li key={r.finding.id} className="rounded-md border border-line bg-space-850/60 px-3 py-2 text-sm">
                    <span className="text-ink-muted line-through">{r.finding.title}</span>
                    <span className="block text-xs text-ink-faint">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        <Panel title="Deterministic rules" eyebrow={`Thresholds: ${REFERENCE_CONFIG.status}`} icon={ListTree}>
          <ul className="space-y-2.5">
            {RULES.map((r) => {
              const fired = firedRules.has(r.id);
              return (
                <li key={r.id} className="flex gap-3">
                  <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full", fired ? "bg-level-caution" : "bg-space-700")} aria-hidden />
                  <div>
                    <p className={cx("text-sm font-medium", fired ? "text-ink" : "text-ink-muted")}>
                      {r.name} {fired && <span className="text-[10px] font-semibold uppercase tracking-wider text-level-caution">· triggered</span>}
                    </p>
                    <p className="text-xs text-ink-faint">{r.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>

      <Panel title="Event history" eyebrow="Detections, escalations and clearances" icon={History}>
        <EventTable events={state.events} />
      </Panel>
    </div>
  );
}
