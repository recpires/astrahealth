"use client";

import { useMemo, useState } from "react";
import { Database, HeartPulse, PenLine } from "lucide-react";
import { Badge, Button, Panel, cx } from "@/components/ui/primitives";
import type { ToneName } from "@/components/ui/levels";
import { CrewPicker, Field, Note, ReferenceLink, Segmented, inputClass } from "@/components/future/common";
import { crewName } from "@/features/journal/config";
import { useFuture } from "@/features/platform/FutureProvider";
import { METHOD_TEXT, METRICS, TELEMETRY_CREW } from "@/features/profile/config";
import { buildProfile, validateEntry, type MetricView, type TelemetrySnapshot, type Trend, type Validation } from "@/features/profile/logic";
import { useMission } from "@/state/MissionProvider";

const VALIDATION_TONE: Record<Validation, ToneName> = {
  simulated: "sensor",
  "self-reported": "advisory",
  "crew-entered (not validated)": "accent",
  "demo seed (simulated)": "neutral",
  "no data": "neutral",
};

const TREND_TEXT: Record<Trend, string> = {
  rising: "↗ rising",
  falling: "↘ falling",
  stable: "→ stable",
  "insufficient data": "· too few points",
  "n/a": "—",
};

/** Read-only snapshot of the tested Monitoring simulation (never written to). */
export function useTelemetrySnapshot(): TelemetrySnapshot {
  const { view } = useMission();
  const s = view.effective.sensors;
  return useMemo(
    () => ({
      scenario: view.scenario.shortName,
      values: {
        hr: { value: s.hr.lastValue, sensorStatus: s.hr.status, quality: s.hr.quality },
        spo2: { value: s.spo2.lastValue, sensorStatus: s.spo2.status, quality: s.spo2.quality },
        temp: { value: s.temp.lastValue, sensorStatus: s.temp.status, quality: s.temp.quality },
      },
    }),
    [view.scenario.shortName, s.hr.lastValue, s.hr.status, s.hr.quality, s.spo2.lastValue, s.spo2.status, s.spo2.quality, s.temp.lastValue, s.temp.status, s.temp.quality],
  );
}

function formatValue(m: MetricView): string {
  if (m.value === null) return "No data";
  return `${m.value.toFixed(m.def.decimals)} ${m.def.unit}`;
}

function MetricRow({ m }: { m: MetricView }) {
  const unavailable = m.def.method === "unavailable";
  return (
    <li className={cx("rounded-lg border p-2.5", unavailable ? "border-dashed border-line" : "border-line")} data-testid={`metric-${m.def.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink">{m.def.label}</p>
        <p className={cx("tabular whitespace-nowrap font-mono text-sm", m.value === null ? "text-ink-faint" : "text-ink")} data-testid={`metric-value-${m.def.id}`}>
          {formatValue(m)}
        </p>
      </div>
      {unavailable ? (
        <dl className="mt-1 grid gap-0.5 text-[11px] text-ink-muted">
          <div>
            <dt className="inline text-ink-faint">Required exam: </dt>
            <dd className="inline">{m.requiredExam}</dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">Equipment: </dt>
            <dd className="inline">{m.def.equipment} — not available in this demo</dd>
          </div>
          <div>
            <dt className="inline text-ink-faint">Last result: </dt>
            <dd className="inline">{m.lastResult}</dd>
          </div>
          <dd className="text-level-caution/90">ASTRA Health does not simulate or estimate this value.</dd>
        </dl>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-muted">
          <span>{m.timeText}</span>
          <span className="text-ink-faint">·</span>
          <span>{m.origin}</span>
          <Badge tone={VALIDATION_TONE[m.validation]}>{m.validation}</Badge>
          <span>quality: {m.quality}</span>
          <span>trend: {TREND_TEXT[m.trend]}</span>
          {m.stale && <Badge tone="caution">stale</Badge>}
        </div>
      )}
    </li>
  );
}

function EntryForm() {
  const { dispatch, crewId } = useFuture();
  const devices = METRICS.filter((m) => m.method === "crew-device");
  const [metricId, setMetricId] = useState(devices[0].id);
  const [value, setValue] = useState("");
  const [quality, setQuality] = useState<"good" | "questionable">("good");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const def = devices.find((d) => d.id === metricId)!;

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = value.trim() === "" ? NaN : Number(value);
        const errs = validateEntry(metricId, v);
        setErrors(errs);
        if (errs.length) return;
        dispatch({ type: "profile/add-entry", crewId, metricId, value: v, quality, note });
        setDone(`${def.label} recorded for ${crewName(crewId)}.`);
        setValue("");
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Reading">
          <select className={inputClass} value={metricId} onChange={(e) => setMetricId(e.target.value)} data-testid="metric-select">
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.unit})
              </option>
            ))}
          </select>
        </Field>
        <Field label={`Value (${def.unit})`} hint={`Typing check ${def.inputRange![0]}–${def.inputRange![1]} — not a clinical limit`}>
          <input className={inputClass} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} data-testid="metric-input" />
        </Field>
      </div>
      <Segmented
        label="Measurement quality (crew judgement)"
        value={quality}
        options={[
          { value: "good", label: "Good" },
          { value: "questionable", label: "Questionable" },
        ]}
        onChange={setQuality}
      />
      <Field label="Note (optional)">
        <input className={inputClass} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {errors.length > 0 && (
        <p role="alert" className="text-xs text-level-warning">
          {errors.join(" ")}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" icon={PenLine} data-testid="metric-submit">
          Record reading
        </Button>
        {done && !errors.length && (
          <span className="text-xs text-level-nominal" role="status">
            {done}
          </span>
        )}
      </div>
      <Note>Values typed in by the crew are stored as “crew-entered (not validated)”. Exams that need unavailable equipment cannot be typed in here.</Note>
    </form>
  );
}

export function ProfileView() {
  const { state, crewId } = useFuture();
  const telemetry = useTelemetrySnapshot();
  const today = state.platform.clock.day;
  const domains = useMemo(
    () => buildProfile({ crewId, today, journal: state.journal, profile: state.profile, telemetry }),
    [crewId, today, state.journal, state.profile, telemetry],
  );
  const all = domains.flatMap((d) => d.metrics);
  const withData = all.filter((m) => m.value !== null).length;
  const unavailable = all.filter((m) => m.def.method === "unavailable").length;
  const stale = all.filter((m) => m.stale).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">FUTURE 03 · Extended Health Metrics — Space Health Profile</h1>
          <p className="text-sm text-ink-muted">Nine domains. Every value shows its time, origin, quality, trend and validation status — or says plainly that there is no data.</p>
        </div>
        <CrewPicker />
      </div>

      <div className="flex flex-wrap gap-2" data-testid="profile-summary">
        <Badge tone="nominal">{withData} with data</Badge>
        <Badge tone="neutral">{unavailable} need unavailable equipment</Badge>
        <Badge tone={stale ? "caution" : "neutral"}>{stale} stale</Badge>
        {crewId !== TELEMETRY_CREW && <Badge tone="neutral">No simulated telemetry for this crew member</Badge>}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3" data-testid="profile-domains">
        {domains.map((d) => (
          <Panel key={d.domain.id} title={d.domain.label} icon={HeartPulse} actions={<Badge tone={d.withData ? "accent" : "neutral"}>{d.withData}/{d.metrics.length} with data</Badge>}>
            <div data-testid={`domain-${d.domain.id}`}>
              <ul className="space-y-2">
                {d.metrics.map((m) => (
                  <MetricRow key={m.def.id} m={m} />
                ))}
              </ul>
              <div className="mt-3 space-y-1 text-[11px] text-ink-faint">
                <p>Context (official NASA HRP risk, association chosen by the team):</p>
                {d.domain.refIds.map((id) => (
                  <div key={id}>
                    <ReferenceLink refId={id} compact />
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`Record a device reading — ${crewName(crewId)}`} icon={PenLine} className="xl:col-span-2">
          <EntryForm key={crewId} />
        </Panel>
        <Panel title="Where values come from" icon={Database}>
          <ul className="space-y-1.5 text-xs text-ink-muted">
            {Object.entries(METHOD_TEXT).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono text-[10px] text-ink-faint">{k}</span> — {v}
              </li>
            ))}
          </ul>
          <div className="mt-3">
            <Note>
              Equipment availability is a demonstration assumption, not a statement about any real vehicle. Simulated telemetry is read from the tested Monitoring
              demo (Crew Member A) and is never written back. No metric here is interpreted as normal or abnormal.
            </Note>
          </div>
        </Panel>
      </div>
    </div>
  );
}
