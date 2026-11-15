/**
 * Decides WHEN the crew should request medical support.
 *
 * ASTRA Health never recommends medication, treatment or clinical
 * interventions. It only indicates when qualified people (the Crew Medical
 * Officer on board and the flight surgeon on Earth) should be brought in.
 * The rules below are demonstration rules pending scientific confirmation.
 */
import type { Confirmation, EffectiveAnalysis } from "@/lib/types";

export type SupportUrgency = "none" | "monitor" | "recommended" | "urgent";

export interface SupportAssessment {
  urgency: SupportUrgency;
  /** True when the crew should actively request medical support now. */
  required: boolean;
  headline: string;
  reasons: string[];
}

/** Persisting deviations at CAUTION level escalate after this many seconds. */
export const PERSISTENCE_ESCALATION_SEC = 180;

export function assessMedicalSupport(
  analysis: EffectiveAnalysis,
  confirmations: Confirmation[],
  openedAt: Record<string, number>,
): SupportAssessment {
  const vital = analysis.findings.filter((f) => f.category === "vital-deviation");
  const sensor = analysis.findings.filter((f) => f.category === "sensor-issue" && f.ruleId !== "SENSOR_EXCLUDED");
  const reasons: string[] = [];
  let urgency = "none" as SupportUrgency;
  const raise = (u: SupportUrgency) => {
    const order: SupportUrgency[] = ["none", "monitor", "recommended", "urgent"];
    if (order.indexOf(u) > order.indexOf(urgency)) urgency = u;
  };

  const warnings = vital.filter((f) => f.level === "WARNING");
  if (warnings.length > 0) {
    raise("urgent");
    reasons.push(`${warnings.map((f) => f.title).join("; ")} — beyond the demo caution band with reliable sensor data.`);
  }

  const confirmed = vital.filter((f) => f.ruleId === "VITAL_CONFIRMED");
  if (confirmed.length > 0) {
    raise("recommended");
    reasons.push("A confirmation reading reproduced the abnormal value.");
  }

  if (vital.length >= 2) {
    raise("recommended");
    reasons.push(`${vital.length} vital signs are outside the demo reference ranges at the same time.`);
  }

  const longest = vital.reduce((acc, f) => Math.max(acc, analysis.t - (openedAt[f.id] ?? analysis.t)), 0);
  if (vital.length > 0 && longest >= PERSISTENCE_ESCALATION_SEC) {
    raise("recommended");
    reasons.push(`A deviation has persisted for ${Math.round(longest / 60)} min or more.`);
  }

  if (vital.length > 0 && urgency === "none") {
    raise("monitor");
    reasons.push("A single vital sign is slightly outside the demo range. Follow the safety checklist and keep monitoring.");
  }

  const unableVitals = new Set(confirmations.filter((c) => c.outcome === "unable").map((c) => c.vital));
  const unverifiable = sensor.filter((f) => f.needsConfirmation && unableVitals.has(f.vital));
  if (unverifiable.length > 0) {
    raise("recommended");
    reasons.push("An inconsistent reading could not be verified by the crew.");
  } else if (sensor.length > 0) {
    raise("monitor");
    reasons.push("A sensor problem is open. Complete the sensor check before deciding on medical support.");
  }

  if (analysis.excludedVitals.length > 0 && urgency === "none") {
    reasons.push("The abnormal reading was attributed to the sensor after crew confirmation. Send an informational report.");
  }

  const headline: Record<SupportUrgency, string> = {
    none: "Medical support not required by the demo rules",
    monitor: "Keep monitoring — medical support not yet required",
    recommended: "Request medical support",
    urgent: "Request medical support now",
  };

  return {
    urgency,
    required: urgency === "recommended" || urgency === "urgent",
    headline: headline[urgency],
    reasons: reasons.length ? reasons : ["All readings are within the demo reference ranges."],
  };
}
