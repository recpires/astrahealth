"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Cpu,
  Droplets,
  HeartPulse,
  RotateCcw,
  ShieldCheck,
  Siren,
  Thermometer,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { REFERENCE_CONFIG, formatRange, formatVital } from "@/config/reference-ranges";
import { classifyValue } from "@/lib/analysis/engine";
import { CHART_WINDOW, isPlaybackComplete, missionHistory } from "@/lib/mission/reducer";
import { SCENARIO_ORDER, SCENARIOS } from "@/lib/scenarios";
import { formatMET } from "@/lib/time";
import { VITAL_KEYS, type ScenarioId, type VitalKey } from "@/lib/types";
import { useMission } from "@/state/MissionProvider";
import { Badge, Button, DemoTag, Panel, ProgressBar, cx } from "@/components/ui/primitives";
import { LEVEL_TEXT, LEVEL_TONE, SENSOR_TEXT, SENSOR_TONE, TONES } from "@/components/ui/levels";
import { VitalChart, type ChartPoint } from "@/components/monitor/VitalChart";

const VITAL_ICON: Record<VitalKey, LucideIcon> = { hr: HeartPulse, spo2: Droplets, temp: Thermometer };

function ScenarioControl() {
  const { state, view, dispatch } = useMission();
  const start = (id: ScenarioId) => dispatch({ type: "START_SCENARIO", scenarioId: id });
  return (
    <Panel
      title="Demonstration scenarios"
      eyebrow="Simulation control"
      icon={Siren}
      actions={<DemoTag />}
      bodyClassName="flex flex-col gap-4 lg:flex-row lg:items-center"
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" icon={Siren} onClick={() => start("vital-deviation")} data-testid="simulate-incident">
          Simulate incident
        </Button>
        <Button variant="sensor" icon={Unplug} onClick={() => start("sensor-fault")} data-testid="simulate-sensor-fault">
          Simulate sensor fault
        </Button>
        <Button variant="ghost" icon={RotateCcw} onClick={() => start("nominal")} data-testid="reset-nominal">
          Reset to nominal
        </Button>
      </div>
      <div className="min-w-0 flex-1 lg:border-l lg:border-line lg:pl-4">
        <div className="flex flex-wrap items-center gap-2">
          {SCENARIO_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => start(id)}
              aria-pressed={state.scenarioId === id}
              className={cx(
                "rounded-md border px-2 py-0.5 text-xs",
                state.scenarioId === id ? "border-accent/60 bg-accent/10 text-accent" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              {SCENARIOS[id].name.split(" — ")[0]} · {SCENARIOS[id].shortName}
            </button>
          ))}
          {isPlaybackComplete(state) && <Badge tone="neutral">Recording ended — holding last sample</Badge>}
        </div>
        <p className="mt-2 text-sm text-ink-muted" data-testid="scenario-description">
          <span className="font-medium text-ink">{view.scenario.name}.</span> {view.scenario.description}
        </p>
      </div>
    </Panel>
  );
}

function VitalCard({ vital, series }: { vital: VitalKey; series: ChartPoint[] }) {
  const { view } = useMission();
  const vc = REFERENCE_CONFIG.vitals[vital];
  const sensor = view.effective.sensors[vital];
  const excluded = view.effective.excludedVitals.includes(vital);
  const value = sensor.lastValue;
  const c = value === null ? null : classifyValue(vital, value);
  const tone = excluded ? "sensor" : value === null ? "neutral" : LEVEL_TONE[c!.level];
  const t = TONES[tone];
  const Icon = VITAL_ICON[vital];
  const stateText = excluded
    ? "Excluded — sensor artifact"
    : value === null
      ? "No reading"
      : c!.side === null
        ? "Within demo range"
        : `${c!.side === "high" ? "Above" : "Below"} demo range`;

  return (
    <section
      className={cx("flex min-w-0 flex-col rounded-xl border bg-space-900/85 p-4", t.border)}
      data-testid={`vital-card-${vital}`}
      aria-label={`${vc.label} (simulated)`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cx("grid h-8 w-8 place-items-center rounded-lg border", t.border, t.bg)}>
            <Icon aria-hidden className={cx("h-4 w-4", t.text)} />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-ink">{vc.label}</p>
            <p className="text-[11px] text-ink-faint">Demo ref. {formatRange(vital, vc.normal)}</p>
          </div>
        </div>
        <DemoTag label="Sim" />
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className={cx("tabular font-mono text-5xl font-semibold leading-none", excluded ? "text-level-sensor line-through decoration-2" : "text-ink")}>
          {formatVital(vital, value)}
        </span>
        <span className="pb-1 text-sm text-ink-muted">{vc.unit}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge tone={tone}>{stateText}</Badge>
        <Badge tone={SENSOR_TONE[sensor.status]}>Sensor {SENSOR_TEXT[sensor.status]}</Badge>
      </div>
      <div className="-mx-1 mt-3 h-40 min-h-40 flex-1">
        <VitalChart vital={vital} data={series} excluded={excluded} />
      </div>
      <div className="mt-2">
        <div className="mb-1 flex justify-between text-[11px] text-ink-faint">
          <span>Signal quality</span>
          <span className="tabular font-mono">{Math.round(sensor.quality * 100)} %</span>
        </div>
        <ProgressBar value={sensor.quality} tone={sensor.quality >= 0.6 ? "nominal" : sensor.quality >= 0.4 ? "caution" : "warning"} label={`${vc.shortLabel} signal quality`} />
      </div>
    </section>
  );
}

function SensorPanel() {
  const { view } = useMission();
  return (
    <Panel title="Sensor status" eyebrow="Hardware (simulated)" icon={Cpu}>
      <ul className="space-y-3">
        {VITAL_KEYS.map((k) => {
          const s = view.effective.sensors[k];
          const vc = REFERENCE_CONFIG.vitals[k];
          const excluded = view.effective.excludedVitals.includes(k);
          return (
            <li key={k} className="rounded-lg border border-line bg-space-850/60 p-3" data-testid={`sensor-${k}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-ink">{vc.sensorName}</p>
                <Badge tone={SENSOR_TONE[s.status]}>{excluded ? "Excluded" : SENSOR_TEXT[s.status]}</Badge>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <span className="w-16 text-[11px] text-ink-faint">{vc.shortLabel}</span>
                <ProgressBar value={s.quality} tone={s.quality >= 0.6 ? "nominal" : s.quality >= 0.4 ? "caution" : "warning"} label={`${vc.shortLabel} quality`} />
                <span className="tabular w-10 text-right font-mono text-[11px] text-ink-muted">{Math.round(s.quality * 100)}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function StatusPanel() {
  const { state, view } = useMission();
  const e = view.effective;
  const tone = LEVEL_TONE[e.level];
  return (
    <Panel title="System assessment" eyebrow="Rule engine" icon={ShieldCheck} tone={tone}>
      <div className="flex items-center gap-3">
        <span className={cx("h-3 w-3 rounded-full", TONES[tone].dot, e.level === "WARNING" && "pulse-ring")} />
        <p className={cx("text-2xl font-bold tracking-wide", TONES[tone].text)} data-testid="overall-level">
          {LEVEL_TEXT[e.level].toUpperCase()}
        </p>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{e.summary}</p>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Open findings</dt>
          <dd className="tabular font-mono text-lg text-ink">{e.findings.length}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Data reliability</dt>
          <dd className="text-lg text-ink">
            {e.reliability.label} <span className="tabular font-mono text-xs text-ink-faint">{e.reliability.score}%</span>
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Last sample</dt>
          <dd className="tabular font-mono text-sm text-ink-muted">{formatMET(state.analysis.t)}</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/analysis" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
          Understand <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {e.findings.length > 0 && (
          <Link href="/response" className="ml-3 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Act <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </Panel>
  );
}

export function MonitorView() {
  const { state } = useMission();
  const series = useMemo(() => {
    const history = missionHistory(state, CHART_WINDOW);
    const out = {} as Record<VitalKey, ChartPoint[]>;
    for (const k of VITAL_KEYS) out[k] = history.map((s) => ({ t: s.t, value: s[k] }));
    return out;
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">01 · Measure</p>
          <h1 className="text-2xl font-semibold text-ink">Vital-sign monitoring</h1>
        </div>
        <p className="max-w-xl text-xs text-ink-faint">
          Simulated sensor stream, one sample every 10 s of mission time. Green band = provisional demo reference range; dashed red
          lines = caution limits. Not real astronaut data.
        </p>
      </div>
      <ScenarioControl />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:col-span-3">
          {VITAL_KEYS.map((k) => (
            <VitalCard key={k} vital={k} series={series[k]} />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-1">
          <StatusPanel />
          <SensorPanel />
        </div>
      </div>
    </div>
  );
}
