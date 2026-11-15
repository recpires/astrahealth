/**
 * Shared domain types for ASTRA Health.
 *
 * All vital-sign data in this application is SIMULATED for demonstration
 * purposes. Nothing here represents real astronaut data.
 */

export type VitalKey = "hr" | "spo2" | "temp";

export const VITAL_KEYS: readonly VitalKey[] = ["hr", "spo2", "temp"] as const;

/** One simulated sensor sample. */
export interface VitalSample {
  /** Mission elapsed time, in seconds. */
  t: number;
  /** Heart rate (beats per minute). `null` = no reading (dropout). */
  hr: number | null;
  /** Peripheral oxygen saturation (%). `null` = no reading (dropout). */
  spo2: number | null;
  /** Body (skin) temperature (°C). `null` = no reading (dropout). */
  temp: number | null;
  /** Signal quality index reported by each simulated sensor (0 = unusable, 1 = excellent). */
  quality: Record<VitalKey, number>;
}

export type ScenarioId = "nominal" | "vital-deviation" | "sensor-fault";

/** A reading taken on request during the confirmation step (simulated). */
export interface ConfirmationReading {
  hr: number;
  spo2: number;
  temp: number;
  quality: number;
}

/** Shape of each JSON file in `src/data/scenarios`. */
export interface ScenarioData {
  id: ScenarioId;
  name: string;
  shortName: string;
  description: string;
  simulated: true;
  disclaimer: string;
  crewMember: string;
  sampleIntervalSec: number;
  /** Index at which the scripted incident starts (null for the nominal scenario). */
  incidentOnsetIndex: number | null;
  /** Index at which playback begins so the charts already show some history. */
  playbackStartIndex: number;
  /** When true the recording loops; otherwise playback holds on the last sample. */
  loop: boolean;
  /** Result returned when the crew member takes a confirmation reading. */
  confirmationReading: ConfirmationReading;
  generator: { script: string; seed: number };
  samples: VitalSample[];
}

/**
 * Attention levels, from lowest to highest.
 * These are demo attention levels, NOT clinical triage categories.
 */
export type AttentionLevel = "NOMINAL" | "ADVISORY" | "CAUTION" | "WARNING";

export const LEVEL_RANK: Record<AttentionLevel, number> = {
  NOMINAL: 0,
  ADVISORY: 1,
  CAUTION: 2,
  WARNING: 3,
};

export type FindingCategory = "vital-deviation" | "sensor-issue";

export type RuleId =
  | "VITAL_OUT_OF_RANGE"
  | "SENSOR_DROPOUT"
  | "SENSOR_IMPLAUSIBLE"
  | "SENSOR_ABRUPT_CHANGE"
  | "SENSOR_LOW_QUALITY"
  | "SENSOR_FLATLINE"
  | "READING_INCONSISTENT"
  | "SENSOR_EXCLUDED"
  | "VITAL_CONFIRMED";

export interface Finding {
  /** Stable identifier: same id while the condition persists. */
  id: string;
  ruleId: RuleId;
  category: FindingCategory;
  vital: VitalKey;
  level: AttentionLevel;
  title: string;
  /** Plain-language explanation for the crew member. Never a diagnosis. */
  explanation: string;
  /** Short factual evidence (values compared with the demo reference). */
  evidence: string;
  /** True when the crew member should confirm the measurement. */
  needsConfirmation: boolean;
}

export type SensorStatus = "online" | "degraded" | "no-signal" | "suspect";

export interface SensorState {
  vital: VitalKey;
  status: SensorStatus;
  quality: number;
  lastValue: number | null;
}

export type ReliabilityLabel = "High" | "Medium" | "Low";

export interface Reliability {
  /** 0–100. Describes how trustworthy the DATA is, not how certain any interpretation is. */
  score: number;
  label: ReliabilityLabel;
  /** Score of each vital sign's data (excluded vitals are omitted). */
  perVital: Partial<Record<VitalKey, number>>;
  factors: string[];
}

export type OverallStatus = "nominal" | "vital-deviation" | "sensor-issue" | "mixed";

export interface AnalysisResult {
  t: number;
  level: AttentionLevel;
  status: OverallStatus;
  findings: Finding[];
  reliability: Reliability;
  sensors: Record<VitalKey, SensorState>;
  summary: string;
}

export type AnalysisEventType = "detected" | "escalated" | "de-escalated" | "cleared" | "system";

export interface AnalysisEvent {
  id: string;
  t: number;
  type: AnalysisEventType;
  level: AttentionLevel;
  findingId?: string;
  category?: FindingCategory;
  title: string;
  detail: string;
}

export type ConfirmationOutcome = "artifact" | "confirmed" | "unable";

/** Result of the crew confirmation step for one sensor. */
export interface Confirmation {
  id: string;
  vital: VitalKey;
  /** Mission time (s) when the confirmation was recorded. */
  t: number;
  outcome: ConfirmationOutcome;
  reading: ConfirmationReading | null;
}

export interface ResolvedFinding {
  finding: Finding;
  confirmationId: string;
  reason: string;
}

/** Analysis after crew confirmations have been applied. */
export interface EffectiveAnalysis extends AnalysisResult {
  resolved: ResolvedFinding[];
  excludedVitals: VitalKey[];
}
