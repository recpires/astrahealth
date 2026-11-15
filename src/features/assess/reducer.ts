/**
 * FUTURE 02 reducer: records each assessment with the rule set version, the
 * matched rules, the evidence shown and a checksum of the inputs, then lets the
 * crew medical officer accept or override the proposal (human in the loop).
 */
import {
  LEVEL_LABEL,
  SYMPTOM_RULESET_REF,
  assessSymptom,
  validateAssessmentInput,
  type AssessmentInput,
  type AssessmentOutput,
} from "@/features/assess/engine";
import { SYMPTOMS, crewName } from "@/features/journal/config";
import type { CrewId, JournalData } from "@/features/journal/types";
import type { AuditDraft, MissionTime, ModuleResult, OutboxDraft } from "@/features/platform/types";

export interface AssessmentReview {
  decision: "accepted" | "overridden";
  by: string;
  note: string;
  at: MissionTime;
}

export interface AssessmentRecord {
  id: string;
  crewId: CrewId;
  at: MissionTime;
  input: AssessmentInput;
  output: AssessmentOutput;
  review: AssessmentReview | null;
  reportQueued: boolean;
}

export interface AssessState {
  schemaVersion: 1;
  records: AssessmentRecord[];
}

export const EMPTY_ASSESS: AssessState = { schemaVersion: 1, records: [] };

export type AssessAction =
  | { type: "assess/submit"; input: AssessmentInput }
  | { type: "assess/review"; recordId: string; decision: "accepted" | "overridden"; by: string; note: string }
  | { type: "assess/queue-report"; recordId: string };

export interface AssessContext {
  now: MissionTime;
  journal: JournalData;
  newId: (prefix: string) => string;
}

const symptomLabel = (id: string) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;

export function assessReducer(state: AssessState, action: AssessAction, ctx: AssessContext): ModuleResult<AssessState> {
  const audit: AuditDraft[] = [];
  const outbox: OutboxDraft[] = [];
  switch (action.type) {
    case "assess/submit": {
      if (validateAssessmentInput(action.input).length) return { state, audit, outbox };
      const input = { ...action.input, notes: action.input.notes.trim().slice(0, 500), warningSigns: [...action.input.warningSigns] };
      const output = assessSymptom(input, ctx.journal, ctx.now.day);
      const record: AssessmentRecord = { id: ctx.newId("SA"), crewId: input.crewId, at: ctx.now, input, output, review: null, reportQueued: false };
      audit.push({
        module: "F02",
        kind: "decision",
        summary: `Assessment of “${symptomLabel(input.symptom)}” for ${crewName(input.crewId)}: ${LEVEL_LABEL[output.level]} (proposal awaiting review).`,
        refs: {
          crewId: input.crewId,
          recordId: record.id,
          ruleSet: SYMPTOM_RULESET_REF,
          ruleIds: output.matchedRules.map((r) => r.id),
          inputChecksum: output.inputChecksum,
        },
      });
      audit.push({
        module: "F02",
        kind: "evidence",
        summary: `Evidence shown: ${output.evidence.scientific.length} NASA reference(s), ${output.evidence.local.length} journal fact(s); uncertainty ${output.uncertainty.level}.`,
        refs: { recordId: record.id, evidenceIds: output.evidence.scientific.map((s) => s.refId) },
      });
      return { state: { ...state, records: [...state.records, record] }, audit, outbox };
    }

    case "assess/review": {
      const rec = state.records.find((r) => r.id === action.recordId);
      if (!rec || rec.review) return { state, audit, outbox };
      const note = action.note.trim().slice(0, 300);
      if (action.decision === "overridden" && !note) return { state, audit, outbox };
      const review: AssessmentReview = { decision: action.decision, by: action.by.trim() || "Crew medical officer", note, at: ctx.now };
      audit.push({
        module: "F02",
        kind: "decision",
        summary: `${review.by} ${action.decision === "accepted" ? "accepted" : "overrode"} the proposal for ${crewName(rec.crewId)}${note ? ` — “${note}”` : ""}.`,
        refs: { crewId: rec.crewId, recordId: rec.id, ruleSet: rec.output.ruleSet },
      });
      return { state: { ...state, records: state.records.map((r) => (r.id === rec.id ? { ...r, review } : r)) }, audit, outbox };
    }

    case "assess/queue-report": {
      const rec = state.records.find((r) => r.id === action.recordId);
      if (!rec || rec.reportQueued) return { state, audit, outbox };
      const priority = rec.output.suggestedPriority ?? "routine";
      outbox.push({
        module: "F02",
        priority,
        title: `Symptom assessment ${rec.id} — ${crewName(rec.crewId)}`,
        summary: `${symptomLabel(rec.input.symptom)} · ${rec.input.severity} · ${LEVEL_LABEL[rec.output.level]} · rules ${rec.output.ruleSet} (${rec.output.matchedRules.map((r) => r.id).join(", ")})${rec.review ? ` · CMO ${rec.review.decision}` : " · not yet reviewed"}`,
        recordId: rec.id,
      });
      audit.push({
        module: "F02",
        kind: "action",
        summary: `Assessment ${rec.id} queued for Earth (${priority}).`,
        refs: { crewId: rec.crewId, recordId: rec.id },
      });
      return { state: { ...state, records: state.records.map((r) => (r.id === rec.id ? { ...r, reportQueued: true } : r)) }, audit, outbox };
    }
  }
}

/** Assessments that hold EVA participation (any proposal with the NO-EVA step in the last 2 mission days). */
export function evaHoldingAssessments(state: AssessState, crewId: CrewId, today: number): AssessmentRecord[] {
  return state.records.filter((r) => r.crewId === crewId && r.at.day >= today - 1 && r.output.steps.some((s) => s.id === "NO-EVA"));
}
