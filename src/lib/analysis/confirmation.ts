/**
 * Crew confirmation of inconsistent measurements.
 *
 * When the engine flags a reading as inconsistent, the crew member checks the
 * sensor and takes a confirmation reading. This module evaluates that reading
 * and applies the outcome on top of the raw analysis result.
 */
import { REFERENCE_CONFIG, formatVital, type ReferenceConfig } from "@/config/reference-ranges";
import { classifyValue, maxLevel, reliabilityLabel, summarize } from "@/lib/analysis/engine";
import {
  LEVEL_RANK,
  VITAL_KEYS,
  type AnalysisResult,
  type Confirmation,
  type ConfirmationReading,
  type EffectiveAnalysis,
  type Finding,
  type OverallStatus,
  type ResolvedFinding,
  type VitalKey,
} from "@/lib/types";

/** Decides whether a confirmation reading confirms or contradicts the stream. */
export function evaluateConfirmation(
  vital: VitalKey,
  reading: ConfirmationReading,
  config: ReferenceConfig = REFERENCE_CONFIG,
): "artifact" | "confirmed" {
  return classifyValue(vital, reading[vital], config).side === null ? "artifact" : "confirmed";
}

/** Vitals that currently have at least one finding asking for confirmation. */
export function vitalsNeedingConfirmation(findings: Finding[]): VitalKey[] {
  return VITAL_KEYS.filter((k) => findings.some((f) => f.vital === k && f.needsConfirmation));
}

export function applyConfirmations(
  result: AnalysisResult,
  confirmations: Confirmation[],
  openedAt: Record<string, number>,
  config: ReferenceConfig = REFERENCE_CONFIG,
): EffectiveAnalysis {
  let findings = [...result.findings];
  const resolved: ResolvedFinding[] = [];
  const excludedVitals: VitalKey[] = [];
  const sensors = { ...result.sensors };

  // Latest confirmation per vital wins.
  const latest = new Map<VitalKey, Confirmation>();
  for (const c of confirmations) latest.set(c.vital, c);

  for (const [vital, c] of latest) {
    const vc = config.vitals[vital];
    const covered = (f: Finding) => f.vital === vital && (openedAt[f.id] ?? -Infinity) <= c.t;

    if (c.outcome === "artifact" && c.reading) {
      const affected = findings.filter(covered);
      if (affected.length === 0) continue;
      const reason = `Confirmation reading ${formatVital(vital, c.reading[vital], config)} ${vc.unit} is within the demo reference range — the stream values are attributed to the sensor.`;
      for (const f of affected) resolved.push({ finding: f, confirmationId: c.id, reason });
      findings = findings.filter((f) => !covered(f));
      findings.push({
        id: `SENSOR_EXCLUDED:${vital}`,
        ruleId: "SENSOR_EXCLUDED",
        category: "sensor-issue",
        vital,
        level: "ADVISORY",
        title: `${vc.label} sensor excluded — reading attributed to sensor`,
        explanation: `The crew confirmation reading was within the demo reference range, so the abnormal stream values are treated as a sensor artifact and excluded. Re-seat or replace the sensor; monitoring of the other vital signs continues.`,
        evidence: reason,
        needsConfirmation: false,
      });
      excludedVitals.push(vital);
      sensors[vital] = { ...sensors[vital], status: "suspect" };
    }

    if (c.outcome === "confirmed" && c.reading) {
      const inconsistent = findings.find((f) => f.id === `READING_INCONSISTENT:${vital}` && covered(f));
      if (!inconsistent) continue;
      const level = classifyValue(vital, c.reading[vital], config).level;
      const reason = `Confirmation reading ${formatVital(vital, c.reading[vital], config)} ${vc.unit} is also outside the demo reference range.`;
      resolved.push({ finding: inconsistent, confirmationId: c.id, reason });
      findings = findings.filter((f) => f.id !== inconsistent.id);
      findings.push({
        id: `VITAL_CONFIRMED:${vital}`,
        ruleId: "VITAL_CONFIRMED",
        category: "vital-deviation",
        vital,
        level: LEVEL_RANK[level] < LEVEL_RANK.CAUTION ? "CAUTION" : level,
        title: `${vc.label} deviation confirmed by re-measurement`,
        explanation: `A second, good-quality reading confirms that ${vc.label.toLowerCase()} is outside the demo reference range. This is not a diagnosis; follow the escalation guidance.`,
        evidence: reason,
        needsConfirmation: false,
      });
    }
    // "unable": findings are kept as they are; escalation logic takes it into account.
  }

  if (resolved.length === 0) return { ...result, resolved, excludedVitals };

  findings.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.id.localeCompare(b.id));
  const hasVital = findings.some((f) => f.category === "vital-deviation");
  const hasSensor = findings.some((f) => f.category === "sensor-issue");
  const status: OverallStatus = hasVital && hasSensor ? "mixed" : hasVital ? "vital-deviation" : hasSensor ? "sensor-issue" : "nominal";
  const level = maxLevel(findings.map((f) => f.level));

  let reliability = result.reliability;
  if (excludedVitals.length > 0) {
    const perVital = { ...result.reliability.perVital };
    for (const k of excludedVitals) delete perVital[k];
    const scores = Object.values(perVital) as number[];
    const score = scores.length ? Math.min(...scores) : 0;
    const excludedLabels = excludedVitals.map((k) => config.vitals[k].shortLabel);
    reliability = {
      score,
      label: reliabilityLabel(score),
      perVital,
      factors: [
        `${excludedLabels.join(", ")} excluded after crew confirmation (sensor artifact)`,
        ...result.reliability.factors.filter((f) => !excludedLabels.some((l) => f.startsWith(l))),
      ],
    };
  }

  const summary =
    excludedVitals.length > 0 && status === "sensor-issue" && level === "ADVISORY"
      ? `Crew confirmation attributed the abnormal ${excludedVitals.map((k) => config.vitals[k].label.toLowerCase()).join(" and ")} readings to the sensor. Remaining vital signs are within the demo reference ranges.`
      : summarize(status, level, findings);

  return { ...result, findings, level, status, reliability, sensors, summary, resolved, excludedVitals };
}
