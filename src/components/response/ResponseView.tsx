"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeAlert,
  Check,
  ClipboardList,
  Crosshair,
  NotebookPen,
  ScanSearch,
  Stethoscope,
  TriangleAlert,
} from "lucide-react";
import { REFERENCE_CONFIG, formatVital } from "@/config/reference-ranges";
import { vitalsNeedingConfirmation } from "@/lib/analysis/confirmation";
import { PROCEDURE_DISCLAIMER, type Procedure } from "@/lib/response/procedures";
import { formatMET, formatDuration } from "@/lib/time";
import type { ActionKind } from "@/lib/report/incident-report";
import { useMission } from "@/state/MissionProvider";
import { Badge, Button, EmptyState, Panel, buttonClass, cx } from "@/components/ui/primitives";
import { CATEGORY_TEXT, CATEGORY_TONE, LEVEL_TEXT, LEVEL_TONE, TONES, URGENCY_TONE, type ToneName } from "@/components/ui/levels";

const OUTCOME: Record<string, { text: string; tone: ToneName }> = {
  artifact: { text: "Not reproduced — sensor artifact", tone: "nominal" },
  confirmed: { text: "Reproduced — deviation confirmed", tone: "warning" },
  unable: { text: "Unable to re-measure", tone: "caution" },
};

const ACTION_TONE: Record<ActionKind, ToneName> = {
  system: "accent",
  crew: "advisory",
  procedure: "nominal",
  confirmation: "sensor",
  comms: "caution",
};

function IdentifiedEvent() {
  const { state, view } = useMission();
  const e = view.effective;
  const primary = e.findings[0];
  const tone = LEVEL_TONE[e.level];
  return (
    <Panel title="Identified event" eyebrow="From the analysis module" icon={Crosshair} tone={tone}>
      {!primary ? (
        <EmptyState>No event identified. Routine monitoring continues.</EmptyState>
      ) : (
        <div data-testid="identified-event">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone} pulse={e.level === "WARNING"}>
              {LEVEL_TEXT[e.level]}
            </Badge>
            <Badge tone={CATEGORY_TONE[primary.category]}>{CATEGORY_TEXT[primary.category]}</Badge>
            <span className="ml-auto tabular font-mono text-[11px] text-ink-faint">since {formatMET(state.openedAt[primary.id] ?? e.t)}</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-ink">{primary.title}</h3>
          <p className="mt-1 text-sm text-ink-muted">{e.summary}</p>
          {e.findings.length > 1 && (
            <ul className="mt-3 space-y-1 text-sm">
              {e.findings.slice(1).map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-ink-muted">
                  <span className={cx("h-1.5 w-1.5 rounded-full", TONES[LEVEL_TONE[f.level]].dot)} />
                  {f.title}
                </li>
              ))}
            </ul>
          )}
          <Link href="/analysis" className="mt-3 inline-flex items-center gap-1 text-sm text-accent hover:underline">
            See explanation and evidence <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </Panel>
  );
}

function MedicalSupport() {
  const { state, view } = useMission();
  const s = view.support;
  const tone = URGENCY_TONE[s.urgency];
  return (
    <Panel title="Medical support" eyebrow="When to call qualified people" icon={Stethoscope} tone={tone}>
      <div className={cx("rounded-lg border p-3", TONES[tone].border, TONES[tone].bg)} data-testid="medical-support">
        <p className={cx("flex items-center gap-2 text-base font-bold", TONES[tone].text)}>
          {s.required ? <BadgeAlert className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          {s.headline}
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          {s.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      {s.required && (
        <div className="mt-3 space-y-1 text-sm text-ink-muted">
          <p>
            <span className="font-semibold text-ink">On board:</span> Crew Medical Officer (CMO).
          </p>
          <p>
            <span className="font-semibold text-ink">On Earth:</span> flight surgeon — every message takes about{" "}
            {formatDuration(state.comms.oneWayDelayMin * 60)} each way (simulated), so act on board first.
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/comms" className={buttonClass(s.required ? "danger" : "secondary", "sm")}>
          <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          Prepare report for Earth
        </Link>
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        ASTRA Health never recommends medication, treatment or clinical interventions. Escalation rules are demonstration rules
        pending scientific confirmation.
      </p>
    </Panel>
  );
}

function ConfirmationPanel() {
  const { state, view, dispatch } = useMission();
  const pending = vitalsNeedingConfirmation(view.effective.findings);
  if (pending.length === 0 && state.confirmations.length === 0) return null;
  return (
    <Panel title="Measurement confirmation" eyebrow="Inconsistent readings" icon={ScanSearch} tone={pending.length ? "sensor" : undefined}>
      <div id="confirm" className="space-y-4">
        {pending.map((k) => {
          const vc = REFERENCE_CONFIG.vitals[k];
          return (
            <div key={k} className="rounded-lg border border-level-sensor/40 bg-level-sensor/10 p-3" data-testid={`confirm-${k}`}>
              <p className="flex items-center gap-2 font-semibold text-level-sensor">
                <TriangleAlert className="h-4 w-4" /> Please confirm the {vc.label.toLowerCase()} measurement
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                The {vc.sensorName.replace(" (simulated)", "").toLowerCase()} shows values that do not match the other signals. Before
                acting, check the sensor and take one confirmation reading.
              </p>
              <ol className="mt-2 list-decimal space-y-0.5 pl-5 text-sm text-ink-muted">
                <li>Stay still for about 30 seconds.</li>
                <li>Check sensor placement, contact and cable/link.</li>
                <li>Take the confirmation reading.</li>
              </ol>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="sensor" icon={ScanSearch} onClick={() => dispatch({ type: "TAKE_CONFIRMATION_READING", vital: k })}>
                  Take confirmation reading
                </Button>
                <Button variant="ghost" onClick={() => dispatch({ type: "REPORT_UNABLE_TO_CONFIRM", vital: k })}>
                  Unable to re-measure
                </Button>
              </div>
            </div>
          );
        })}
        {state.confirmations.length > 0 && (
          <ul className="space-y-2">
            {state.confirmations.map((c) => {
              const vc = REFERENCE_CONFIG.vitals[c.vital];
              const o = OUTCOME[c.outcome];
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-space-850/60 px-3 py-2 text-sm" data-testid="confirmation-result">
                  <span className="tabular font-mono text-xs text-ink-faint">{formatMET(c.t)}</span>
                  <span className="text-ink">{vc.label}</span>
                  {c.reading && (
                    <span className="tabular font-mono text-ink-muted">
                      {formatVital(c.vital, c.reading[c.vital])} {vc.unit}
                    </span>
                  )}
                  <Badge tone={o.tone} className="ml-auto">
                    {o.text}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-ink-faint">The confirmation reading is part of the simulated scenario data.</p>
      </div>
    </Panel>
  );
}

function ProcedureCard({ procedure }: { procedure: Procedure }) {
  const { state, view, dispatch } = useMission();
  const needsConfirm = vitalsNeedingConfirmation(view.effective.findings);
  const done = procedure.steps.filter((s) => `${procedure.id}:${s.id}` in state.completedSteps).length;
  const tone: ToneName =
    procedure.trigger === "escalation" ? "warning" : procedure.trigger === "vital-deviation" ? "caution" : procedure.trigger.startsWith("sensor") ? "sensor" : "nominal";
  return (
    <Panel
      title={procedure.title}
      eyebrow={`${procedure.id} · demonstration procedure`}
      icon={ClipboardList}
      tone={tone}
      actions={
        <span className="tabular font-mono text-xs text-ink-muted">
          {done}/{procedure.steps.length}
        </span>
      }
    >
      <p className="text-sm text-ink-muted">{procedure.purpose}</p>
      <ol className="mt-3 space-y-1.5" data-testid={`procedure-${procedure.id}`}>
        {procedure.steps.map((step, i) => {
          const key = `${procedure.id}:${step.id}`;
          const checked = key in state.completedSteps;
          return (
            <li key={step.id}>
              <label
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm transition-colors",
                  checked ? "border-level-nominal/40 bg-level-nominal/5 text-ink-muted" : "border-line bg-space-850/50 text-ink hover:border-line-strong",
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-[#34d399]"
                  checked={checked}
                  onChange={() => dispatch({ type: "TOGGLE_STEP", procedureId: procedure.id, stepId: step.id, text: step.text })}
                />
                <span className="tabular font-mono text-xs text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                <span className={cx("flex-1", checked && "line-through decoration-ink-faint")}>{step.text}</span>
                {checked && <span className="tabular font-mono text-[10px] text-level-nominal">{formatMET(state.completedSteps[key])}</span>}
              </label>
              {step.action === "confirm-measurement" && needsConfirm.length > 0 && (
                <div className="ml-10 mt-1.5 flex flex-wrap gap-2">
                  {needsConfirm.map((k) => (
                    <Button key={k} size="sm" variant="sensor" icon={ScanSearch} onClick={() => dispatch({ type: "TAKE_CONFIRMATION_READING", vital: k })}>
                      Take {REFERENCE_CONFIG.vitals[k].shortLabel} confirmation reading
                    </Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function ActionLog() {
  const { state, dispatch } = useMission();
  const rows = [...state.actions].reverse();
  return (
    <Panel
      title={`Action log (${state.actions.length})`}
      eyebrow="Time-stamped, included in the report"
      icon={NotebookPen}
      actions={
        <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "LOG_ACTION", kind: "crew", text: "Crew note: situation acknowledged" })}>
          + Acknowledge
        </Button>
      }
    >
      <ul className="max-h-[360px] space-y-1.5 overflow-auto" data-testid="action-log">
        {rows.map((a) => (
          <li key={a.id} className="rounded-md border border-line/70 bg-space-850/50 px-3 py-1.5 text-sm">
            <div className="flex items-center gap-2">
              <span className="tabular font-mono text-xs text-ink-faint">{formatMET(a.t)}</span>
              <Badge tone={ACTION_TONE[a.kind]}>{a.kind}</Badge>
            </div>
            <p className="mt-0.5 text-ink-muted">{a.text}</p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export function ResponseView() {
  const { view } = useMission();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">03 · Act</p>
          <h1 className="text-2xl font-semibold text-ink">Autonomous response</h1>
        </div>
        <p className="max-w-xl rounded-md border border-level-caution/40 bg-level-caution/10 px-3 py-2 text-xs text-level-caution">
          {PROCEDURE_DISCLAIMER}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <IdentifiedEvent />
        <MedicalSupport />
      </div>
      <ConfirmationPanel />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="grid grid-cols-1 content-start gap-4 xl:col-span-2">
          {view.procedures.map((p) => (
            <ProcedureCard key={p.id} procedure={p} />
          ))}
        </div>
        <ActionLog />
      </div>
    </div>
  );
}
