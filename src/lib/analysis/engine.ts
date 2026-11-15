/**
 * Deterministic analysis engine.
 *
 * Pure functions only: the same history always yields the same result.
 * The engine never produces a diagnosis. It compares simulated readings with
 * PROVISIONAL demo reference ranges and checks whether the sensors themselves
 * look trustworthy.
 */
import { REFERENCE_CONFIG, formatRange, formatVital, type ReferenceConfig } from "@/config/reference-ranges";
import {
  LEVEL_RANK,
  VITAL_KEYS,
  type AnalysisResult,
  type AttentionLevel,
  type Finding,
  type OverallStatus,
  type Reliability,
  type SensorState,
  type VitalKey,
  type VitalSample,
} from "@/lib/types";

/** Number of trailing samples the engine needs to evaluate every rule. */
export const ANALYSIS_WINDOW = 24;

export function maxLevel(levels: AttentionLevel[]): AttentionLevel {
  return levels.reduce<AttentionLevel>((acc, l) => (LEVEL_RANK[l] > LEVEL_RANK[acc] ? l : acc), "NOMINAL");
}

type Side = "high" | "low";

/** Classifies a single value against the demo bands. */
export function classifyValue(
  key: VitalKey,
  value: number,
  config: ReferenceConfig = REFERENCE_CONFIG,
): { level: AttentionLevel; side: Side | null } {
  const v = config.vitals[key];
  if (value >= v.normal[0] && value <= v.normal[1]) return { level: "NOMINAL", side: null };
  const side: Side = value > v.normal[1] ? "high" : "low";
  const insideCaution = value >= v.caution[0] && value <= v.caution[1];
  return { level: insideCaution ? "CAUTION" : "WARNING", side };
}

interface RangeState {
  out: boolean;
  side: Side | null;
  level: AttentionLevel;
  recent: number[];
}

/**
 * Range rule with persistence and hysteresis: a deviation is reported only
 * after N consecutive valid samples are outside the demo range on the same
 * side, and is cleared only after N consecutive valid samples are back inside.
 * Missing samples (dropouts) are skipped.
 */
export function evaluateRange(
  key: VitalKey,
  history: VitalSample[],
  config: ReferenceConfig = REFERENCE_CONFIG,
): RangeState {
  const n = config.persistenceSamples;
  const values = history.map((s) => s[key]).filter((v): v is number => v !== null);
  let out = false;
  let side: Side | null = null;
  let outRun = 0;
  let outRunSide: Side | null = null;
  let inRun = 0;

  for (const value of values) {
    const c = classifyValue(key, value, config);
    if (c.side === null) {
      inRun += 1;
      outRun = 0;
      outRunSide = null;
      if (out && inRun >= n) {
        out = false;
        side = null;
      }
    } else {
      inRun = 0;
      outRun = c.side === outRunSide ? outRun + 1 : 1;
      outRunSide = c.side;
      if (outRun >= n) {
        out = true;
        side = c.side;
      }
    }
  }

  const recent = values.slice(-n);
  let level: AttentionLevel = "NOMINAL";
  if (out) {
    // Level = least severe of the last N valid values that sit on the deviation side,
    // so a single extreme value cannot escalate the level on its own.
    const sameSide = recent.filter((v) => classifyValue(key, v, config).side === side);
    const levels = sameSide.map((v) => classifyValue(key, v, config).level);
    level = levels.length === n && levels.every((l) => l === "WARNING") ? "WARNING" : "CAUTION";
  }
  return { out, side, level, recent };
}

function fmtList(key: VitalKey, values: (number | null)[], config: ReferenceConfig): string {
  return values.map((v) => formatVital(key, v, config)).join(", ");
}

interface SensorChecks {
  dropouts: number;
  lastIsNull: boolean;
  implausible: number[];
  jumps: { from: number; to: number }[];
  meanQuality: number;
  flatline: boolean;
}

export function evaluateSensor(
  key: VitalKey,
  history: VitalSample[],
  config: ReferenceConfig = REFERENCE_CONFIG,
): SensorChecks {
  const v = config.vitals[key];
  const look = history.slice(-config.sensorLookbackSamples);
  const values = look.map((s) => s[key]);
  const dropouts = values.filter((x) => x === null).length;
  const lastIsNull = values.length > 0 && values[values.length - 1] === null;
  const implausible = values.filter((x): x is number => x !== null && (x < v.plausible[0] || x > v.plausible[1]));

  // Abrupt changes: compare consecutive valid values within the lookback window.
  // The sample just before the window is included so a jump into the window is caught.
  const withPrev = history.slice(-(config.sensorLookbackSamples + 1)).map((s) => s[key]);
  const valid = withPrev.filter((x): x is number => x !== null);
  const jumps: { from: number; to: number }[] = [];
  for (let i = 1; i < valid.length; i++) {
    if (Math.abs(valid[i] - valid[i - 1]) > v.maxStepDelta) jumps.push({ from: valid[i - 1], to: valid[i] });
  }

  const q = history.slice(-config.persistenceSamples).map((s) => s.quality[key]);
  const meanQuality = q.length ? q.reduce((a, b) => a + b, 0) / q.length : 1;

  let flatline = false;
  if (v.flatlineSamples !== null) {
    const tail = history.slice(-v.flatlineSamples).map((s) => s[key]);
    flatline =
      tail.length === v.flatlineSamples && tail.every((x) => x !== null && x === tail[0]);
  }

  return { dropouts, lastIsNull, implausible, jumps, meanQuality, flatline };
}

function sensorStatus(checks: SensorChecks, suspect: boolean, config: ReferenceConfig): SensorState["status"] {
  if (checks.lastIsNull) return "no-signal";
  if (suspect) return "suspect";
  if (checks.meanQuality < config.degradedQuality || checks.dropouts > 0) return "degraded";
  return "online";
}

/**
 * Analyses the most recent sample of `history` (ordered oldest → newest).
 */
export function analyze(history: VitalSample[], config: ReferenceConfig = REFERENCE_CONFIG): AnalysisResult {
  const window = history.slice(-ANALYSIS_WINDOW);
  const last = window[window.length - 1];
  const t = last?.t ?? 0;
  const findings: Finding[] = [];
  const sensors = {} as Record<VitalKey, SensorState>;
  const reliabilityFactors: string[] = [];
  const penalty: Record<VitalKey, number> = { hr: 0, spo2: 0, temp: 0 };

  const ranges = {} as Record<VitalKey, RangeState>;
  const suspectByVital = {} as Record<VitalKey, boolean>;

  for (const key of VITAL_KEYS) {
    const vc = config.vitals[key];
    const checks = evaluateSensor(key, window, config);
    const range = evaluateRange(key, window, config);
    ranges[key] = range;

    // --- Sensor rules -------------------------------------------------------
    if (checks.dropouts > 0) {
      findings.push({
        id: `SENSOR_DROPOUT:${key}`,
        ruleId: "SENSOR_DROPOUT",
        category: "sensor-issue",
        vital: key,
        level: checks.dropouts >= 2 ? "CAUTION" : "ADVISORY",
        title: `${vc.label}: missing readings`,
        explanation: `The ${vc.sensorName.replace(" (simulated)", "").toLowerCase()} did not deliver ${checks.dropouts} of the last ${config.sensorLookbackSamples} readings. This usually points to a contact or connection problem, not to a change in the body.`,
        evidence: `${checks.dropouts} dropout(s) in the last ${config.sensorLookbackSamples} samples.`,
        needsConfirmation: false,
      });
      penalty[key] += 5 * checks.dropouts;
      reliabilityFactors.push(`${vc.shortLabel}: ${checks.dropouts} missing reading(s)`);
    }

    if (checks.implausible.length > 0) {
      findings.push({
        id: `SENSOR_IMPLAUSIBLE:${key}`,
        ruleId: "SENSOR_IMPLAUSIBLE",
        category: "sensor-issue",
        vital: key,
        level: "CAUTION",
        title: `${vc.label}: physically implausible value`,
        explanation: `A reading fell outside the range a working sensor should report. Treat the value as unreliable until it is confirmed.`,
        evidence: `Value(s) ${fmtList(key, checks.implausible, config)} outside plausibility limits ${formatRange(key, vc.plausible, config)}.`,
        needsConfirmation: true,
      });
      penalty[key] += 20;
      reliabilityFactors.push(`${vc.shortLabel}: implausible value`);
    }

    if (checks.jumps.length > 0) {
      const j = checks.jumps[checks.jumps.length - 1];
      findings.push({
        id: `SENSOR_ABRUPT_CHANGE:${key}`,
        ruleId: "SENSOR_ABRUPT_CHANGE",
        category: "sensor-issue",
        vital: key,
        level: checks.jumps.length >= 2 ? "CAUTION" : "ADVISORY",
        title: `${vc.label}: abrupt jump between readings`,
        explanation: `The value changed between two consecutive readings faster than the demo rules consider physiologically plausible. Sudden jumps are a typical sign of sensor movement or poor contact.`,
        evidence: `${checks.jumps.length} jump(s) larger than ${vc.maxStepDelta} ${vc.unit}; latest ${formatVital(key, j.from, config)} → ${formatVital(key, j.to, config)} ${vc.unit}.`,
        needsConfirmation: true,
      });
      penalty[key] += 10;
      reliabilityFactors.push(`${vc.shortLabel}: abrupt change(s)`);
    }

    if (checks.meanQuality < config.degradedQuality) {
      const poor = checks.meanQuality < config.poorQuality;
      findings.push({
        id: `SENSOR_LOW_QUALITY:${key}`,
        ruleId: "SENSOR_LOW_QUALITY",
        category: "sensor-issue",
        vital: key,
        level: poor ? "CAUTION" : "ADVISORY",
        title: `${vc.label}: ${poor ? "poor" : "degraded"} signal quality`,
        explanation: `The sensor reports that its own signal is ${poor ? "poor" : "weaker than usual"}. Readings may not reflect the real value.`,
        evidence: `Mean signal quality ${(checks.meanQuality * 100).toFixed(0)} % over the last ${config.persistenceSamples} samples (degraded below ${config.degradedQuality * 100} %).`,
        needsConfirmation: false,
      });
      reliabilityFactors.push(`${vc.shortLabel}: ${poor ? "poor" : "degraded"} signal quality`);
    }

    if (checks.flatline) {
      findings.push({
        id: `SENSOR_FLATLINE:${key}`,
        ruleId: "SENSOR_FLATLINE",
        category: "sensor-issue",
        vital: key,
        level: "CAUTION",
        title: `${vc.label}: value frozen`,
        explanation: `The sensor has reported exactly the same value for a long time. A real signal normally varies a little, so the sensor may be stuck.`,
        evidence: `${vc.flatlineSamples} identical consecutive readings (${formatVital(key, last?.[key] ?? null, config)} ${vc.unit}).`,
        needsConfirmation: true,
      });
      penalty[key] += 20;
      reliabilityFactors.push(`${vc.shortLabel}: frozen value`);
    }

    const suspect =
      checks.implausible.length > 0 ||
      checks.jumps.length > 0 ||
      checks.flatline ||
      checks.meanQuality < config.poorQuality ||
      checks.dropouts >= 2;
    suspectByVital[key] = suspect;

    sensors[key] = {
      vital: key,
      status: sensorStatus(checks, suspect, config),
      quality: last ? last.quality[key] : 0,
      lastValue: last ? last[key] : null,
    };
  }

  // --- Range rules + cross-signal consistency --------------------------------
  const deviating = VITAL_KEYS.filter((k) => ranges[k].out);
  const reliableDeviations = deviating.filter((k) => !suspectByVital[k]);

  for (const key of deviating) {
    const vc = config.vitals[key];
    const r = ranges[key];
    const direction = r.side === "high" ? "above" : "below";
    const others = VITAL_KEYS.filter((k) => k !== key);
    const steadyOthers = others.filter((k) => !ranges[k].out).map((k) => config.vitals[k].label.toLowerCase());

    if (suspectByVital[key]) {
      findings.push({
        id: `READING_INCONSISTENT:${key}`,
        ruleId: "READING_INCONSISTENT",
        category: "sensor-issue",
        vital: key,
        level: "CAUTION",
        title: `${vc.label}: reading inconsistent — confirmation needed`,
        explanation: `${vc.label} reads ${direction} the demo reference range, but the sensor shows signs of malfunction${
          steadyOthers.length ? ` and ${steadyOthers.join(" and ")} remain${steadyOthers.length === 1 ? "s" : ""} steady` : ""
        }. The system cannot tell whether the change is real. Please check the sensor and take a confirmation reading.`,
        evidence: `Recent values ${fmtList(key, r.recent, config)} ${vc.unit} vs demo reference ${formatRange(key, vc.normal, config)}; sensor flagged as suspect.`,
        needsConfirmation: true,
      });
    } else {
      const corroborated = reliableDeviations.length >= 2;
      findings.push({
        id: `VITAL_OUT_OF_RANGE:${key}`,
        ruleId: "VITAL_OUT_OF_RANGE",
        category: "vital-deviation",
        vital: key,
        level: r.level,
        title: `${vc.label} ${direction} demo reference range`,
        explanation: `${vc.label} has stayed ${direction} the demo reference range for at least ${config.persistenceSamples} consecutive readings and the sensor signal is good${
          corroborated ? ", and other vital signs are changing at the same time" : ""
        }. This is a change worth attention; it is not a diagnosis.`,
        evidence: `Last ${r.recent.length} values ${fmtList(key, r.recent, config)} ${vc.unit}; demo reference ${formatRange(key, vc.normal, config)}${
          r.level === "WARNING" ? `; beyond caution band ${formatRange(key, vc.caution, config)}` : ""
        }.`,
        needsConfirmation: false,
      });
    }
  }

  if (reliableDeviations.length >= 2) {
    reliabilityFactors.push(`${reliableDeviations.length} vital signs change together with good signal (corroboration)`);
  }

  // --- Aggregate ---------------------------------------------------------------
  findings.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.id.localeCompare(b.id));

  const reliability = computeReliability(
    VITAL_KEYS.map((k) => ({ key: k, quality: last ? last.quality[k] : 0, penalty: penalty[k] })),
    reliableDeviations.length >= 2,
    reliabilityFactors,
  );

  const hasVital = findings.some((f) => f.category === "vital-deviation");
  const hasSensor = findings.some((f) => f.category === "sensor-issue");
  const status: OverallStatus = hasVital && hasSensor ? "mixed" : hasVital ? "vital-deviation" : hasSensor ? "sensor-issue" : "nominal";
  const level = maxLevel(findings.map((f) => f.level));

  return { t, level, status, findings, reliability, sensors, summary: summarize(status, level, findings) };
}

/**
 * Data reliability: per-vital score = current signal quality minus rule penalties.
 * The overall score is the weakest vital's score — one unreliable sensor is
 * enough to make the overall picture less trustworthy.
 */
export function computeReliability(
  parts: { key: VitalKey; quality: number; penalty: number }[],
  corroborated: boolean,
  factors: string[],
): Reliability {
  const perVital = {} as Partial<Record<VitalKey, number>>;
  for (const p of parts) {
    perVital[p.key] = Math.round(Math.max(0, Math.min(100, p.quality * 100 - p.penalty + (corroborated ? 3 : 0))));
  }
  const scores = Object.values(perVital) as number[];
  const score = scores.length ? Math.min(...scores) : 0;
  return {
    score,
    label: reliabilityLabel(score),
    perVital,
    factors: factors.length ? factors : ["All sensors report good signal quality"],
  };
}

export function reliabilityLabel(score: number): Reliability["label"] {
  return score >= 80 ? "High" : score >= 55 ? "Medium" : "Low";
}

export function summarize(status: OverallStatus, level: AttentionLevel, findings: Finding[]): string {
  switch (status) {
    case "nominal":
      return "All simulated readings are within the demo reference ranges and the sensors look reliable.";
    case "vital-deviation": {
      const n = findings.filter((f) => f.category === "vital-deviation").length;
      return `${n} vital sign${n > 1 ? "s are" : " is"} outside the demo reference range with reliable sensor data (${level}).`;
    }
    case "sensor-issue":
      return "A sensor is behaving abnormally. The readings may not reflect the body — confirm the measurement before acting on it.";
    case "mixed":
      return "Vital-sign deviations and sensor problems are present at the same time. Confirm the suspect readings and keep monitoring.";
  }
}
