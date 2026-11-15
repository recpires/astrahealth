/**
 * FUTURE 02 — Symptom Assessment & Evidence Engine.
 *
 * Offline and deterministic. Operational output (attention level, next steps,
 * whether medical support is suggested) comes ONLY from the versioned rule set
 * in src/data/future/symptom-ruleset.json. The evidence part lists the local
 * data and the official NASA references that give context, and states the
 * uncertainty. No language model is involved and nothing here is a diagnosis.
 */
import ruleset from "@/data/future/symptom-ruleset.json";
import { checksumOf } from "@/features/platform/checksum";
import { SYMPTOMS, crewName } from "@/features/journal/config";
import { checkInsByDay } from "@/features/journal/logic";
import type { CrewId, JournalData, SymptomId } from "@/features/journal/types";
import {
  evidenceLevel,
  libraryItemFor,
  referenceById,
  type EvidenceLevel,
} from "@/features/platform/references";
import type { LinkPriority } from "@/features/platform/types";

export type AssessmentLevel = "monitor" | "inform-cmo" | "support-recommended" | "support-now";
export type Severity = "mild" | "moderate" | "severe";
export type Onset = "sudden" | "gradual" | "unknown";
export type SymptomTrend = "improving" | "unchanged" | "worsening" | "unknown";

export interface AssessmentInput {
  crewId: CrewId;
  symptom: SymptomId;
  severity: Severity;
  onset: Onset;
  trend: SymptomTrend;
  durationHours: number | null;
  /** null = not answered. */
  canPerformDuties: boolean | null;
  warningSigns: string[];
  notes: string;
}

interface Condition {
  field: string;
  in?: (string | number | boolean)[];
  equals?: string | number | boolean;
  gte?: number;
  nonEmpty?: boolean;
}

export interface Rule {
  id: string;
  description: string;
  all: Condition[];
  level: AssessmentLevel;
  steps: string[];
}

export interface RuleSet {
  id: string;
  version: string;
  status: "PROVISIONAL";
  provenance: string;
  levels: { id: AssessmentLevel; rank: number; label: string; text: string }[];
  warningSigns: { id: string; label: string }[];
  steps: { id: string; text: string }[];
  rules: Rule[];
  evidenceMap: { note: string; always: string[]; bySymptom: Record<string, string[]> };
}

export const SYMPTOM_RULESET = ruleset as RuleSet;
export const SYMPTOM_RULESET_REF = `${SYMPTOM_RULESET.id}@${SYMPTOM_RULESET.version}`;
export const SYMPTOM_RULESET_CHECKSUM = checksumOf(SYMPTOM_RULESET);

export const LEVEL_RANK: Record<AssessmentLevel, number> = Object.fromEntries(
  SYMPTOM_RULESET.levels.map((l) => [l.id, l.rank]),
) as Record<AssessmentLevel, number>;

export const LEVEL_LABEL: Record<AssessmentLevel, string> = Object.fromEntries(
  SYMPTOM_RULESET.levels.map((l) => [l.id, l.label]),
) as Record<AssessmentLevel, string>;

export const LEVEL_PRIORITY: Record<AssessmentLevel, LinkPriority | null> = {
  monitor: null,
  "inform-cmo": "routine",
  "support-recommended": "priority",
  "support-now": "urgent",
};

export interface ScientificContext {
  refId: string;
  title: string;
  url: string;
  level: EvidenceLevel;
  /** Verbatim risk statement from the evidence library (verified-excerpts only). */
  excerpt: { text: string; where: string; source: string } | null;
}

export interface AssessmentOutput {
  ruleSet: string;
  ruleSetChecksum: string;
  level: AssessmentLevel;
  matchedRules: { id: string; description: string; level: AssessmentLevel }[];
  steps: { id: string; text: string }[];
  supportSuggested: boolean;
  suggestedPriority: LinkPriority | null;
  evidence: {
    /** Facts taken from the local journal (FUTURE 01). */
    local: string[];
    scientific: ScientificContext[];
    association: string;
  };
  uncertainty: { level: "high" | "moderate"; reasons: string[] };
  inputChecksum: string;
}

/** Input values the rules can test, including context derived from the journal. */
export function ruleFacts(input: AssessmentInput, journal: JournalData, today: number): Record<string, unknown> {
  const byDay = checkInsByDay(journal.checkIns, input.crewId);
  let journalDays = 0;
  for (let d = today - 6; d <= today; d++) if (byDay.get(d)?.symptoms.includes(input.symptom)) journalDays++;
  return { ...input, journalDays };
}

function holds(c: Condition, facts: Record<string, unknown>): boolean {
  const v = facts[c.field];
  if (c.nonEmpty !== undefined) return Array.isArray(v) ? v.length > 0 === c.nonEmpty : false;
  if (c.in) return c.in.includes(v as string | number | boolean);
  if (c.equals !== undefined) return v === c.equals;
  if (c.gte !== undefined) return typeof v === "number" && v >= c.gte;
  return false;
}

export function matchRules(facts: Record<string, unknown>, rules: Rule[] = SYMPTOM_RULESET.rules): Rule[] {
  return rules.filter((r) => r.all.every((c) => holds(c, facts)));
}

const symptomLabel = (id: string) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;

export function assessSymptom(input: AssessmentInput, journal: JournalData, today: number): AssessmentOutput {
  const facts = ruleFacts(input, journal, today);
  const matched = matchRules(facts);
  const level = matched.reduce<AssessmentLevel>((acc, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[acc] ? r.level : acc), "monitor");

  // Steps: highest-level rules first, each step once.
  const stepText = new Map(SYMPTOM_RULESET.steps.map((s) => [s.id, s.text]));
  const seen = new Set<string>();
  const steps: { id: string; text: string }[] = [];
  for (const r of [...matched].sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level])) {
    for (const id of r.steps) {
      if (seen.has(id) || !stepText.has(id)) continue;
      seen.add(id);
      steps.push({ id, text: stepText.get(id)! });
    }
  }

  // Local evidence from the journal.
  const byDay = checkInsByDay(journal.checkIns, input.crewId);
  const local: string[] = [];
  const journalDays = facts.journalDays as number;
  local.push(
    journalDays
      ? `Journal: “${symptomLabel(input.symptom)}” reported by ${crewName(input.crewId)} on ${journalDays} of the last 7 days.`
      : `Journal: “${symptomLabel(input.symptom)}” not reported by ${crewName(input.crewId)} in the last 7 days.`,
  );
  const todayEntry = byDay.get(today);
  if (todayEntry) {
    local.push(`Today's check-in: sleep ${todayEntry.sleepHours} h, fatigue ${todayEntry.fatigue}/5, hydration felt ${todayEntry.hydration}/5.`);
  }

  // Scientific context (official references, offline).
  const refIds = [...(SYMPTOM_RULESET.evidenceMap.bySymptom[input.symptom] ?? []), ...SYMPTOM_RULESET.evidenceMap.always];
  const scientific: ScientificContext[] = [];
  for (const id of [...new Set(refIds)]) {
    const ref = referenceById(id);
    if (!ref) continue;
    const item = libraryItemFor(ref);
    scientific.push({
      refId: ref.id,
      title: ref.title,
      url: ref.url,
      level: evidenceLevel(ref),
      excerpt: item ? { text: item.riskStatement.text, where: item.riskStatement.where, source: item.title } : null,
    });
  }

  // Uncertainty is stated, never hidden.
  const reasons: string[] = [];
  const missing: string[] = [];
  if (input.onset === "unknown") missing.push("onset");
  if (input.trend === "unknown") missing.push("trend");
  if (input.durationHours === null) missing.push("duration");
  if (input.canPerformDuties === null) missing.push("ability to perform duties");
  if (missing.length) reasons.push(`Not answered: ${missing.join(", ")}.`);
  if (!todayEntry) reasons.push("No journal check-in today for this crew member, so current sleep, fatigue and hydration are unknown.");
  const symptomSpecific = scientific.filter((s) => !SYMPTOM_RULESET.evidenceMap.always.includes(s.refId));
  if (!symptomSpecific.length) {
    reasons.push("No symptom-specific NASA reference in the local library: scientific context is general only.");
  } else if (symptomSpecific.every((s) => s.level === "reference-only")) {
    reasons.push("The symptom-specific NASA references are reference-only: their content has not been reviewed for this prototype.");
  }
  reasons.push(`The rules (${SYMPTOM_RULESET_REF}) are demonstration rules and are not clinically validated, so uncertainty is never reported as low.`);
  const uncertainty = {
    level: (missing.length >= 2 || !symptomSpecific.length ? "high" : "moderate") as "high" | "moderate",
    reasons,
  };

  return {
    ruleSet: SYMPTOM_RULESET_REF,
    ruleSetChecksum: SYMPTOM_RULESET_CHECKSUM,
    level,
    matchedRules: matched.map((r) => ({ id: r.id, description: r.description, level: r.level })),
    steps,
    supportSuggested: LEVEL_RANK[level] >= LEVEL_RANK["support-recommended"],
    suggestedPriority: LEVEL_PRIORITY[level],
    evidence: { local, scientific, association: SYMPTOM_RULESET.evidenceMap.note },
    uncertainty,
    inputChecksum: checksumOf({ input, journalDays }),
  };
}

/** Input sanity checks (not clinical limits). */
export function validateAssessmentInput(input: AssessmentInput): string[] {
  const errors: string[] = [];
  if (!SYMPTOMS.some((s) => s.id === input.symptom)) errors.push("Choose a symptom.");
  if (input.durationHours !== null && (!Number.isFinite(input.durationHours) || input.durationHours < 0 || input.durationHours > 24 * 60))
    errors.push("Duration must be between 0 and 1440 hours, or left empty.");
  const known = new Set(SYMPTOM_RULESET.warningSigns.map((w) => w.id));
  if (input.warningSigns.some((w) => !known.has(w))) errors.push("Unknown warning sign.");
  return errors;
}
