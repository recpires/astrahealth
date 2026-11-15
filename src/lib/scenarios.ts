import nominal from "@/data/scenarios/nominal.json";
import vitalDeviation from "@/data/scenarios/vital-deviation.json";
import sensorFault from "@/data/scenarios/sensor-fault.json";
import type { ScenarioData, ScenarioId, VitalSample } from "@/lib/types";

export const SCENARIOS: Record<ScenarioId, ScenarioData> = {
  nominal: nominal as ScenarioData,
  "vital-deviation": vitalDeviation as ScenarioData,
  "sensor-fault": sensorFault as ScenarioData,
};

export const SCENARIO_ORDER: ScenarioId[] = ["nominal", "vital-deviation", "sensor-fault"];

export function getScenario(id: ScenarioId): ScenarioData {
  return SCENARIOS[id];
}

/** Last tick that can be played for a scenario (non-looping scenarios stop here). */
export function lastTick(scenario: ScenarioData): number {
  return scenario.loop ? Number.POSITIVE_INFINITY : scenario.samples.length - 1;
}

/**
 * Sample for an absolute playback tick. Looping scenarios wrap around but keep
 * mission time increasing, so charts and the analysis see a continuous series.
 */
export function sampleAt(scenario: ScenarioData, tick: number): VitalSample {
  const n = scenario.samples.length;
  const idx = scenario.loop ? ((tick % n) + n) % n : Math.min(Math.max(tick, 0), n - 1);
  const s = scenario.samples[idx];
  return { ...s, t: tick * scenario.sampleIntervalSec };
}

/** The `length` samples ending at `tick` (inclusive), oldest first. */
export function historyAt(scenario: ScenarioData, tick: number, length: number): VitalSample[] {
  const from = Math.max(0, tick - length + 1);
  const out: VitalSample[] = [];
  for (let k = from; k <= tick; k++) out.push(sampleAt(scenario, k));
  return out;
}
