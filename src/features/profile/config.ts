/**
 * FUTURE 03 — Space Health Profile: the nine domains and their metrics.
 *
 * Every metric declares HOW it can be obtained in this prototype:
 *  - "self-report"        — derived from the FUTURE 01 journal (subjective);
 *  - "sim-telemetry"      — latest value of the tested Monitoring simulation (simulated, Crew Member A only);
 *  - "crew-device"        — read by the crew on an onboard device and typed in (not validated);
 *  - "unavailable"        — needs an exam or equipment this demo does not have. ASTRA Health shows
 *                           the required exam, the last result (none) and "no data". It NEVER
 *                           simulates or estimates these values (e.g. intracranial pressure,
 *                           bone mineral density, kidney imaging).
 *
 * Equipment availability is a DEMONSTRATION ASSUMPTION written by the team, not
 * a statement about any real spacecraft. Input ranges are typing sanity checks,
 * not clinical limits.
 */

export type DomainId =
  | "neuro-ocular"
  | "cardiovascular"
  | "renal"
  | "radiation"
  | "bone"
  | "vascular"
  | "immunological"
  | "emotional"
  | "sleep";

export type MetricMethod = "self-report" | "sim-telemetry" | "crew-device" | "unavailable";

export type JournalSource =
  | { kind: "rating"; key: "sleepHours" | "sleepQuality" | "mood" | "fatigue" | "hydration" }
  | { kind: "fluid" }
  | { kind: "symptom-days"; symptoms: string[] };

export interface MetricDef {
  id: string;
  domain: DomainId;
  label: string;
  unit: string;
  method: MetricMethod;
  decimals: number;
  /** self-report: what to read from the journal. */
  journal?: JournalSource;
  /** sim-telemetry: which simulated vital. */
  telemetry?: "hr" | "spo2" | "temp";
  /** crew-device / unavailable: equipment needed. */
  equipment?: string;
  /** unavailable: what exam would provide the value. */
  requiredExam?: string;
  /** crew-device: accepted typing range (sanity check only). */
  inputRange?: [number, number];
  /** A value older than this many days is shown as stale. */
  freshDays: number;
  /** Change between the first and second half of the window below which the trend is "stable". */
  trendTolerance: number;
}

export interface DomainDef {
  id: DomainId;
  label: string;
  /** Official NASA HRP risk shown as context (see src/data/future/hrr-risk-references.json). */
  refIds: string[];
}

export const DOMAINS: DomainDef[] = [
  { id: "neuro-ocular", label: "Neuro-ocular", refIds: ["hrr-105"] },
  { id: "cardiovascular", label: "Cardiovascular", refIds: ["hrr-179"] },
  { id: "renal", label: "Renal", refIds: ["hrr-81"] },
  { id: "radiation", label: "Radiation", refIds: ["hrr-96"] },
  { id: "bone", label: "Bone", refIds: ["hrr-77"] },
  { id: "vascular", label: "Vascular", refIds: ["hrr-179"] },
  { id: "immunological", label: "Immunological", refIds: ["hrr-85"] },
  { id: "emotional", label: "Emotional & behavioral", refIds: ["hrr-99"] },
  { id: "sleep", label: "Sleep", refIds: ["hrr-100"] },
];

export const METRICS: MetricDef[] = [
  // Neuro-ocular
  { id: "vision-change-days", domain: "neuro-ocular", label: "Vision change reported", unit: "days of last 7", method: "self-report", decimals: 0, journal: { kind: "symptom-days", symptoms: ["vision-change"] }, freshDays: 2, trendTolerance: 1 },
  { id: "visual-acuity", domain: "neuro-ocular", label: "Visual acuity self-check", unit: "decimal acuity", method: "crew-device", decimals: 2, equipment: "Vision chart", inputRange: [0.05, 2.0], freshDays: 14, trendTolerance: 0.1 },
  { id: "oct-imaging", domain: "neuro-ocular", label: "Retina / optic nerve imaging", unit: "—", method: "unavailable", decimals: 0, equipment: "Optical coherence tomography (OCT) imager", requiredExam: "OCT imaging read by a specialist", freshDays: 0, trendTolerance: 0 },
  { id: "icp", domain: "neuro-ocular", label: "Intracranial pressure (direct)", unit: "mmHg", method: "unavailable", decimals: 0, equipment: "Invasive pressure measurement", requiredExam: "Direct measurement by a specialist — not possible on this vehicle in the demo", freshDays: 0, trendTolerance: 0 },

  // Cardiovascular
  { id: "heart-rate", domain: "cardiovascular", label: "Heart rate (latest)", unit: "bpm", method: "sim-telemetry", decimals: 0, telemetry: "hr", freshDays: 1, trendTolerance: 0 },
  { id: "spo2", domain: "cardiovascular", label: "SpO₂ (latest)", unit: "%", method: "sim-telemetry", decimals: 0, telemetry: "spo2", freshDays: 1, trendTolerance: 0 },
  { id: "bp-systolic", domain: "cardiovascular", label: "Blood pressure — systolic", unit: "mmHg", method: "crew-device", decimals: 0, equipment: "Blood pressure monitor", inputRange: [60, 250], freshDays: 7, trendTolerance: 5 },
  { id: "bp-diastolic", domain: "cardiovascular", label: "Blood pressure — diastolic", unit: "mmHg", method: "crew-device", decimals: 0, equipment: "Blood pressure monitor", inputRange: [30, 150], freshDays: 7, trendTolerance: 4 },
  { id: "ecg", domain: "cardiovascular", label: "Electrocardiogram", unit: "—", method: "unavailable", decimals: 0, equipment: "Multi-lead ECG recorder", requiredExam: "ECG recording reviewed by the ground medical team", freshDays: 0, trendTolerance: 0 },

  // Renal
  { id: "fluid-intake", domain: "renal", label: "Fluid intake (self-estimated)", unit: "L / day", method: "self-report", decimals: 1, journal: { kind: "fluid" }, freshDays: 2, trendTolerance: 0.3 },
  { id: "hydration-felt", domain: "renal", label: "Hydration felt", unit: "1–5", method: "self-report", decimals: 0, journal: { kind: "rating", key: "hydration" }, freshDays: 2, trendTolerance: 0.5 },
  { id: "urinalysis", domain: "renal", label: "Urine analysis", unit: "—", method: "unavailable", decimals: 0, equipment: "Urine analysis kit / analyser", requiredExam: "Urine chemistry", freshDays: 0, trendTolerance: 0 },
  { id: "kidney-imaging", domain: "renal", label: "Kidney imaging", unit: "—", method: "unavailable", decimals: 0, equipment: "Ultrasound with trained operator", requiredExam: "Kidney ultrasound read by a specialist", freshDays: 0, trendTolerance: 0 },

  // Radiation
  { id: "personal-dose", domain: "radiation", label: "Personal dosimeter reading", unit: "mSv (cumulative)", method: "crew-device", decimals: 2, equipment: "Personal dosimeter", inputRange: [0, 2000], freshDays: 7, trendTolerance: 1 },
  { id: "biodosimetry", domain: "radiation", label: "Biological dosimetry", unit: "—", method: "unavailable", decimals: 0, equipment: "Laboratory blood analysis", requiredExam: "Blood sample analysed on Earth", freshDays: 0, trendTolerance: 0 },

  // Bone
  { id: "body-mass", domain: "bone", label: "Body mass", unit: "kg", method: "crew-device", decimals: 1, equipment: "Body mass measurement device", inputRange: [30, 200], freshDays: 7, trendTolerance: 0.5 },
  { id: "bone-density", domain: "bone", label: "Bone mineral density", unit: "g/cm²", method: "unavailable", decimals: 0, equipment: "Dual-energy X-ray absorptiometry (DXA) scanner", requiredExam: "DXA scan (ground facility)", freshDays: 0, trendTolerance: 0 },

  // Vascular
  { id: "jugular-flow", domain: "vascular", label: "Jugular vein flow", unit: "—", method: "unavailable", decimals: 0, equipment: "Ultrasound with trained operator", requiredExam: "Venous ultrasound reviewed by the ground team", freshDays: 0, trendTolerance: 0 },
  { id: "headache-days", domain: "vascular", label: "Headache reported", unit: "days of last 7", method: "self-report", decimals: 0, journal: { kind: "symptom-days", symptoms: ["headache"] }, freshDays: 2, trendTolerance: 1 },

  // Immunological
  { id: "body-temp", domain: "immunological", label: "Body temperature (latest)", unit: "°C", method: "sim-telemetry", decimals: 1, telemetry: "temp", freshDays: 1, trendTolerance: 0 },
  { id: "illness-days", domain: "immunological", label: "Congestion / skin irritation reported", unit: "days of last 7", method: "self-report", decimals: 0, journal: { kind: "symptom-days", symptoms: ["congestion", "skin-irritation"] }, freshDays: 2, trendTolerance: 1 },
  { id: "blood-count", domain: "immunological", label: "Blood cell count", unit: "—", method: "unavailable", decimals: 0, equipment: "Blood analyser", requiredExam: "Complete blood count", freshDays: 0, trendTolerance: 0 },

  // Emotional & behavioral
  { id: "mood", domain: "emotional", label: "Mood (self-rating)", unit: "1–5", method: "self-report", decimals: 0, journal: { kind: "rating", key: "mood" }, freshDays: 2, trendTolerance: 0.5 },
  { id: "behavioral-screen", domain: "emotional", label: "Validated behavioral health questionnaire", unit: "—", method: "unavailable", decimals: 0, equipment: "Questionnaire administered with the behavioral health team", requiredExam: "Validated questionnaire scored by professionals", freshDays: 0, trendTolerance: 0 },

  // Sleep
  { id: "sleep-hours", domain: "sleep", label: "Sleep duration", unit: "h", method: "self-report", decimals: 1, journal: { kind: "rating", key: "sleepHours" }, freshDays: 2, trendTolerance: 0.5 },
  { id: "sleep-quality", domain: "sleep", label: "Sleep quality", unit: "1–5", method: "self-report", decimals: 0, journal: { kind: "rating", key: "sleepQuality" }, freshDays: 2, trendTolerance: 0.5 },
  { id: "fatigue", domain: "sleep", label: "Fatigue", unit: "1–5", method: "self-report", decimals: 0, journal: { kind: "rating", key: "fatigue" }, freshDays: 2, trendTolerance: 0.5 },
  { id: "actigraphy", domain: "sleep", label: "Actigraphy (sleep/wake)", unit: "—", method: "unavailable", decimals: 0, equipment: "Wrist actigraphy device", requiredExam: "Actigraphy recording", freshDays: 0, trendTolerance: 0 },
];

export const METHOD_TEXT: Record<MetricMethod, string> = {
  "self-report": "Self-report · FUTURE 01 journal",
  "sim-telemetry": "Simulated telemetry · Monitoring demo",
  "crew-device": "Onboard device · typed in by crew",
  unavailable: "Requires exam / equipment not available",
};

/** The tested Monitoring simulation represents this crew member only. */
export const TELEMETRY_CREW = "crew-a";

export const TREND_WINDOW_DAYS = 14;
