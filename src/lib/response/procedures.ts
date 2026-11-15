import procedureData from "@/data/procedures.json";
import type { EffectiveAnalysis } from "@/lib/types";
import type { SupportAssessment } from "@/lib/response/escalation";

export type ProcedureTrigger = "nominal" | "sensor-issue" | "sensor-artifact" | "vital-deviation" | "escalation";

export interface ProcedureStep {
  id: string;
  text: string;
  action?: "confirm-measurement";
}

export interface Procedure {
  id: string;
  title: string;
  trigger: ProcedureTrigger;
  purpose: string;
  steps: ProcedureStep[];
}

export const PROCEDURE_DISCLAIMER: string = procedureData.disclaimer;
export const PROCEDURES: Procedure[] = procedureData.procedures as Procedure[];

export function getProcedure(trigger: ProcedureTrigger): Procedure {
  const p = PROCEDURES.find((x) => x.trigger === trigger);
  if (!p) throw new Error(`No procedure for trigger ${trigger}`);
  return p;
}

/** Selects the predefined demonstration procedures relevant to the current situation. */
export function selectProcedures(analysis: EffectiveAnalysis, support: SupportAssessment): Procedure[] {
  const triggers: ProcedureTrigger[] = [];
  const openSensor = analysis.findings.some((f) => f.category === "sensor-issue" && f.ruleId !== "SENSOR_EXCLUDED");
  const vital = analysis.findings.some((f) => f.category === "vital-deviation");

  if (support.urgency === "urgent") triggers.push("escalation");
  if (vital) triggers.push("vital-deviation");
  if (openSensor) triggers.push("sensor-issue");
  if (analysis.excludedVitals.length > 0) triggers.push("sensor-artifact");
  if (support.required && !triggers.includes("escalation")) triggers.push("escalation");
  if (triggers.length === 0) triggers.push("nominal");

  return triggers.map(getProcedure);
}
