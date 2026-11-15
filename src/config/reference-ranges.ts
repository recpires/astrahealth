import type { VitalKey } from "@/lib/types";

/**
 * DEMONSTRATION REFERENCE RANGES — PROVISIONAL
 * -------------------------------------------
 * Every number in this file is a placeholder chosen by the development team so
 * that the deterministic rule engine can be demonstrated. They are NOT
 * clinically validated, NOT derived from a NASA resource, and NOT intended for
 * any medical use.
 *
 * Team ANGARIS will confirm the official NASA Space Apps 2026 challenge
 * statement and the NASA scientific resource before these rules are finalised.
 * When that happens, replace the values below and fill `provenance`
 * (see docs/SCIENTIFIC_LIMITATIONS.md and src/config/scientific-sources.ts).
 */

export interface VitalRuleConfig {
  key: VitalKey;
  label: string;
  shortLabel: string;
  unit: string;
  /** Decimal places used when displaying values. */
  decimals: number;
  /** Values inside this band are "within the demo reference range". */
  normal: [number, number];
  /** Outside `normal` but inside this band → CAUTION. Outside this band → WARNING. */
  caution: [number, number];
  /** Values outside this band are treated as physically implausible (likely sensor error). */
  plausible: [number, number];
  /** Largest change between two consecutive samples still considered physiologically plausible. */
  maxStepDelta: number;
  /** Identical consecutive values that indicate a stuck sensor (null = rule disabled). */
  flatlineSamples: number | null;
  /** Fixed chart axis domain. */
  chartDomain: [number, number];
  sensorName: string;
}

export interface ReferenceConfig {
  status: "PROVISIONAL" | "CONFIRMED";
  provenance: string;
  /** Consecutive out-of-range samples required before a deviation is reported. */
  persistenceSamples: number;
  /** Samples scanned when looking for recent dropouts and abrupt changes. */
  sensorLookbackSamples: number;
  /** Mean signal quality below this marks a sensor as degraded. */
  degradedQuality: number;
  /** Mean signal quality below this marks the reading itself as unreliable. */
  poorQuality: number;
  vitals: Record<VitalKey, VitalRuleConfig>;
}

export const REFERENCE_CONFIG: ReferenceConfig = {
  status: "PROVISIONAL",
  provenance:
    "Demonstration placeholder values chosen by the development team. Not clinically validated. Pending confirmation of the official challenge statement and NASA resource.",
  persistenceSamples: 3,
  sensorLookbackSamples: 10,
  degradedQuality: 0.6,
  poorQuality: 0.4,
  vitals: {
    hr: {
      key: "hr",
      label: "Heart rate",
      shortLabel: "HR",
      unit: "bpm",
      decimals: 0,
      normal: [50, 100],
      caution: [40, 120],
      plausible: [25, 230],
      maxStepDelta: 30,
      flatlineSamples: 12,
      chartDomain: [30, 160],
      sensorName: "Chest ECG patch (simulated)",
    },
    spo2: {
      key: "spo2",
      label: "Oxygen saturation",
      shortLabel: "SpO₂",
      unit: "%",
      decimals: 0,
      normal: [95, 100],
      caution: [90, 100],
      plausible: [50, 100],
      maxStepDelta: 6,
      flatlineSamples: null,
      chartDomain: [60, 100],
      sensorName: "Finger pulse oximeter (simulated)",
    },
    temp: {
      key: "temp",
      label: "Body temperature",
      shortLabel: "TEMP",
      unit: "°C",
      decimals: 1,
      normal: [36.0, 37.5],
      caution: [35.5, 38.0],
      plausible: [30, 43],
      maxStepDelta: 0.6,
      // Disabled: skin temperature at 0.1 °C resolution can legitimately stay constant.
      flatlineSamples: null,
      chartDomain: [34, 40],
      sensorName: "Skin temperature probe (simulated)",
    },
  },
};

export function formatVital(key: VitalKey, value: number | null, config: ReferenceConfig = REFERENCE_CONFIG): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(config.vitals[key].decimals);
}

export function formatRange(key: VitalKey, range: [number, number], config: ReferenceConfig = REFERENCE_CONFIG): string {
  const v = config.vitals[key];
  return `${range[0].toFixed(v.decimals)}–${range[1].toFixed(v.decimals)} ${v.unit}`;
}
