/**
 * FUTURE 03 — builds the Space Health Profile of one crew member from local
 * sources only (journal, crew-entered device readings, simulated telemetry).
 * Metrics without equipment are reported as "no data" with the exam required.
 */
import { DOMAINS, METRICS, TELEMETRY_CREW, TREND_WINDOW_DAYS, type DomainDef, type MetricDef } from "@/features/profile/config";
import { checkInsByDay } from "@/features/journal/logic";
import type { CrewId, EntrySource, JournalData } from "@/features/journal/types";
import { formatMissionTime } from "@/features/platform/time";
import type { AuditDraft, MissionTime, ModuleResult } from "@/features/platform/types";
import { crewName } from "@/features/journal/config";

export type Quality = "good" | "questionable" | "subjective" | "simulated" | "unknown";
export type Validation = "simulated" | "self-reported" | "crew-entered (not validated)" | "demo seed (simulated)" | "no data";
export type Trend = "rising" | "falling" | "stable" | "insufficient data" | "n/a";

export interface MetricEntry {
  id: string;
  metricId: string;
  crewId: CrewId;
  at: MissionTime;
  value: number;
  quality: "good" | "questionable";
  note: string;
  source: EntrySource;
}

export interface ProfileState {
  schemaVersion: 1;
  entries: MetricEntry[];
}

export interface TelemetrySnapshot {
  /** Simulation scenario name, for the origin label. */
  scenario: string;
  values: Record<"hr" | "spo2" | "temp", { value: number | null; sensorStatus: string; quality: number }>;
}

export interface MetricView {
  def: MetricDef;
  value: number | null;
  at: MissionTime | null;
  /** Free-text time for values that do not live on the mission-day clock. */
  timeText: string;
  origin: string;
  quality: Quality;
  validation: Validation;
  trend: Trend;
  stale: boolean;
  series: { day: number; value: number }[];
  /** For unavailable metrics. */
  requiredExam: string | null;
  lastResult: string | null;
}

export interface DomainView {
  domain: DomainDef;
  metrics: MetricView[];
  withData: number;
  noData: number;
  stale: number;
}

export function trendOf(series: { value: number }[], tolerance: number): Trend {
  if (series.length < 3) return "insufficient data";
  const half = Math.floor(series.length / 2);
  const mean = (a: { value: number }[]) => a.reduce((s, p) => s + p.value, 0) / a.length;
  const delta = mean(series.slice(series.length - half)) - mean(series.slice(0, half));
  if (Math.abs(delta) <= tolerance) return "stable";
  return delta > 0 ? "rising" : "falling";
}

function journalMetric(def: MetricDef, journal: JournalData, crewId: CrewId, today: number): MetricView {
  const byDay = checkInsByDay(journal.checkIns, crewId);
  const src = def.journal!;
  const series: { day: number; value: number }[] = [];
  let at: MissionTime | null = null;
  let value: number | null = null;

  if (src.kind === "symptom-days") {
    // Rolling 7-day count per day, only on days with a check-in.
    for (let d = Math.max(1, today - TREND_WINDOW_DAYS + 1); d <= today; d++) {
      if (!byDay.has(d)) continue;
      let n = 0;
      for (let k = d - 6; k <= d; k++) if (byDay.get(k)?.symptoms.some((s) => src.symptoms.includes(s))) n++;
      series.push({ day: d, value: n });
    }
  } else {
    for (let d = Math.max(1, today - TREND_WINDOW_DAYS + 1); d <= today; d++) {
      const c = byDay.get(d);
      if (!c) continue;
      const v = src.kind === "fluid" ? c.fluidIntakeL : c[src.key];
      if (v !== null && v !== undefined) series.push({ day: d, value: v });
    }
  }
  const last = series[series.length - 1];
  if (last) {
    value = last.value;
    at = byDay.get(last.day)!.at;
  }
  return {
    def,
    value,
    at,
    timeText: at ? formatMissionTime(at) : "—",
    origin: "Self-report · FUTURE 01 journal",
    quality: value === null ? "unknown" : "subjective",
    validation: value === null ? "no data" : "self-reported",
    trend: trendOf(series, def.trendTolerance),
    stale: at ? today - at.day >= def.freshDays : false,
    series,
    requiredExam: null,
    lastResult: null,
  };
}

function deviceMetric(def: MetricDef, entries: MetricEntry[], crewId: CrewId, today: number): MetricView {
  const own = entries
    .filter((e) => e.metricId === def.id && e.crewId === crewId && e.at.day <= today)
    .sort((a, b) => a.at.day - b.at.day || a.at.minute - b.at.minute);
  const last = own[own.length - 1];
  const series = own.filter((e) => e.at.day > today - TREND_WINDOW_DAYS * 2).map((e) => ({ day: e.at.day, value: e.value }));
  return {
    def,
    value: last?.value ?? null,
    at: last?.at ?? null,
    timeText: last ? formatMissionTime(last.at) : "—",
    origin: last ? (last.source === "demo-seed" ? "Onboard device · demo seed" : "Onboard device · typed in by crew") : `Onboard device · ${def.equipment}`,
    quality: last ? last.quality : "unknown",
    validation: last ? (last.source === "demo-seed" ? "demo seed (simulated)" : "crew-entered (not validated)") : "no data",
    trend: trendOf(series, def.trendTolerance),
    stale: last ? today - last.at.day >= def.freshDays : false,
    series,
    requiredExam: null,
    lastResult: null,
  };
}

function telemetryMetric(def: MetricDef, telemetry: TelemetrySnapshot | null, crewId: CrewId): MetricView {
  const t = crewId === TELEMETRY_CREW && telemetry ? telemetry.values[def.telemetry!] : null;
  const value = t?.value ?? null;
  return {
    def,
    value,
    at: null,
    timeText: t ? "Live · simulation clock" : "—",
    origin: crewId === TELEMETRY_CREW ? `Simulated telemetry · Monitoring demo${telemetry ? ` (${telemetry.scenario})` : ""}` : "No wearable telemetry for this crew member in the demo",
    quality: t ? (t.sensorStatus === "online" ? "simulated" : "questionable") : "unknown",
    validation: value === null ? "no data" : "simulated",
    trend: "n/a",
    stale: false,
    series: [],
    requiredExam: null,
    lastResult: null,
  };
}

function unavailableMetric(def: MetricDef): MetricView {
  return {
    def,
    value: null,
    at: null,
    timeText: "—",
    origin: `Requires: ${def.equipment}`,
    quality: "unknown",
    validation: "no data",
    trend: "n/a",
    stale: false,
    series: [],
    requiredExam: def.requiredExam ?? null,
    lastResult: "None recorded in ASTRA Health",
  };
}

export function buildProfile(input: {
  crewId: CrewId;
  today: number;
  journal: JournalData;
  profile: ProfileState;
  telemetry: TelemetrySnapshot | null;
}): DomainView[] {
  return DOMAINS.map((domain) => {
    const metrics = METRICS.filter((m) => m.domain === domain.id).map((def) => {
      switch (def.method) {
        case "self-report":
          return journalMetric(def, input.journal, input.crewId, input.today);
        case "crew-device":
          return deviceMetric(def, input.profile.entries, input.crewId, input.today);
        case "sim-telemetry":
          return telemetryMetric(def, input.telemetry, input.crewId);
        case "unavailable":
          return unavailableMetric(def);
      }
    });
    return {
      domain,
      metrics,
      withData: metrics.filter((m) => m.value !== null).length,
      noData: metrics.filter((m) => m.value === null).length,
      stale: metrics.filter((m) => m.stale).length,
    };
  });
}

export const EMPTY_PROFILE: ProfileState = { schemaVersion: 1, entries: [] };

export type ProfileAction = {
  type: "profile/add-entry";
  crewId: CrewId;
  metricId: string;
  value: number;
  quality: "good" | "questionable";
  note: string;
};

export function validateEntry(metricId: string, value: number): string[] {
  const def = METRICS.find((m) => m.id === metricId);
  if (!def) return ["Unknown metric."];
  if (def.method !== "crew-device") return [`${def.label} cannot be typed in: ${def.method === "unavailable" ? "it requires an exam or equipment that is not available" : "it comes from another source"}.`];
  const [lo, hi] = def.inputRange!;
  if (!Number.isFinite(value) || value < lo || value > hi) return [`Value must be between ${lo} and ${hi} ${def.unit} (typing check, not a clinical limit).`];
  return [];
}

export function profileReducer(
  state: ProfileState,
  action: ProfileAction,
  ctx: { now: MissionTime; newId: (prefix: string) => string },
): ModuleResult<ProfileState> {
  const audit: AuditDraft[] = [];
  if (validateEntry(action.metricId, action.value).length) return { state, audit, outbox: [] };
  const def = METRICS.find((m) => m.id === action.metricId)!;
  const entry: MetricEntry = {
    id: ctx.newId("ME"),
    metricId: def.id,
    crewId: action.crewId,
    at: ctx.now,
    value: Number(action.value.toFixed(def.decimals)),
    quality: action.quality,
    note: action.note.trim().slice(0, 200),
    source: "crew-entry",
  };
  audit.push({
    module: "F03",
    kind: "data",
    summary: `${def.label}: ${entry.value} ${def.unit} entered for ${crewName(action.crewId)} (${action.quality}, not validated).`,
    refs: { crewId: action.crewId, recordId: entry.id },
  });
  return { state: { ...state, entries: [...state.entries, entry] }, audit, outbox: [] };
}
