/**
 * FUTURE 01 reducer. Pure: returns the new journal plus audit / outbox records
 * for the shared platform trail.
 */
import { JOURNAL_RULESET_REF, ROUTINES, crewName } from "@/features/journal/config";
import { journalFlags, validateCheckIn } from "@/features/journal/logic";
import type { CheckInDraft, CrewId, JournalData } from "@/features/journal/types";
import { formatMissionTime } from "@/features/platform/time";
import type { AuditDraft, MissionTime, ModuleResult, OutboxDraft } from "@/features/platform/types";

export type JournalAction =
  | { type: "journal/submit-checkin"; crewId: CrewId; draft: CheckInDraft }
  | { type: "journal/complete-routine"; crewId: CrewId; routineId: string; note: string }
  | { type: "journal/queue-summary"; crewId: CrewId };

export interface JournalContext {
  now: MissionTime;
  newId: (prefix: string) => string;
}

export function journalReducer(state: JournalData, action: JournalAction, ctx: JournalContext): ModuleResult<JournalData> {
  const audit: AuditDraft[] = [];
  const outbox: OutboxDraft[] = [];
  const today = ctx.now.day;

  switch (action.type) {
    case "journal/submit-checkin": {
      const errors = validateCheckIn(action.draft);
      if (errors.length) return { state, audit, outbox };
      const before = new Set(journalFlags(state, action.crewId, today).map((f) => f.id));
      // One check-in per crew member per day: a new submission replaces today's entry.
      const replaced = state.checkIns.some((c) => c.crewId === action.crewId && c.at.day === today);
      const checkIn = {
        ...action.draft,
        symptoms: [...action.draft.symptoms],
        notes: action.draft.notes.trim().slice(0, 500),
        id: ctx.newId("CI"),
        crewId: action.crewId,
        at: ctx.now,
        source: "crew-entry" as const,
      };
      const next: JournalData = {
        ...state,
        checkIns: [...state.checkIns.filter((c) => !(c.crewId === action.crewId && c.at.day === today)), checkIn],
      };
      audit.push({
        module: "F01",
        kind: "data",
        summary: `${replaced ? "Updated" : "Recorded"} daily check-in for ${crewName(action.crewId)} (${formatMissionTime(ctx.now)}).`,
        refs: { crewId: action.crewId, recordId: checkIn.id },
      });
      const after = journalFlags(next, action.crewId, today);
      const raised = after.filter((f) => !before.has(f.id));
      if (raised.length) {
        audit.push({
          module: "F01",
          kind: "decision",
          summary: `Journal rules raised ${raised.map((f) => f.id).join(", ")} for ${crewName(action.crewId)}.`,
          refs: { crewId: action.crewId, ruleSet: JOURNAL_RULESET_REF, ruleIds: raised.map((f) => f.id), recordId: checkIn.id },
        });
      }
      return { state: next, audit, outbox };
    }

    case "journal/complete-routine": {
      const routine = ROUTINES.find((r) => r.id === action.routineId);
      if (!routine || routine.id === "daily-checkin") return { state, audit, outbox };
      const completion = {
        id: ctx.newId("RC"),
        routineId: routine.id,
        crewId: action.crewId,
        at: ctx.now,
        note: action.note.trim().slice(0, 200),
        source: "crew-entry" as const,
      };
      audit.push({
        module: "F01",
        kind: "action",
        summary: `${routine.title} marked done for ${crewName(action.crewId)}.`,
        refs: { crewId: action.crewId, recordId: completion.id },
      });
      return { state: { ...state, completions: [...state.completions, completion] }, audit, outbox };
    }

    case "journal/queue-summary": {
      const flags = journalFlags(state, action.crewId, today);
      const summary = flags.length
        ? flags.map((f) => `${f.title} (days ${f.days.join(", ")})`).join("; ")
        : "No journal flags.";
      outbox.push({
        module: "F01",
        priority: "routine",
        title: `Journal summary — ${crewName(action.crewId)} — day ${today}`,
        summary,
      });
      audit.push({
        module: "F01",
        kind: "action",
        summary: `Journal summary for ${crewName(action.crewId)} queued for Earth (routine).`,
        refs: { crewId: action.crewId, ruleSet: JOURNAL_RULESET_REF, ruleIds: flags.map((f) => f.id) },
      });
      return { state, audit, outbox };
    }
  }
}
