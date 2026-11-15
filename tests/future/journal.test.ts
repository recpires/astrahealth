/**
 * FUTURE 01 — Health Journal & Daily Check (unit tests of the pure logic and reducer).
 */
import { describe, expect, it } from "vitest";
import seed from "@/data/future/journal-demo.json";
import { JOURNAL_RULES, JOURNAL_RULESET_REF, ROUTINES } from "@/features/journal/config";
import { checkInsByDay, journalFlags, metricSeries, routineStatuses, todaysCheckIn, validateCheckIn } from "@/features/journal/logic";
import { journalReducer } from "@/features/journal/reducer";
import type { CheckInDraft, JournalData } from "@/features/journal/types";
import { seedJournal } from "@/features/platform/store";

const TODAY = 15;
const journal = (): JournalData => seedJournal();
const ctx = (day = TODAY, minute = 480) => {
  let n = 0;
  return { now: { day, minute }, newId: (p: string) => `${p}-T${++n}` };
};
const draft = (over: Partial<CheckInDraft> = {}): CheckInDraft => ({
  sleepHours: 7.2,
  sleepQuality: 4,
  mood: 4,
  fatigue: 2,
  hydration: 4,
  fluidIntakeL: 2.4,
  symptoms: [],
  notes: "",
  ...over,
});

describe("demo seed", () => {
  it("is labelled simulated and covers days 1–14 for four crew members", () => {
    expect(seed.simulated).toBe(true);
    expect(seed.disclaimer).toMatch(/Not real crew data/);
    const days = new Set(seed.checkIns.map((c) => c.at.day));
    expect(Math.min(...days)).toBe(1);
    expect(Math.max(...days)).toBe(14);
    expect(new Set(seed.checkIns.map((c) => c.crewId)).size).toBe(4);
    expect(seed.checkIns.every((c) => c.source === "demo-seed")).toBe(true);
  });
});

describe("routine schedule", () => {
  it("derives overdue / due-today / done-today from completions", () => {
    const d = routineStatuses(journal(), "crew-d", TODAY);
    expect(d.find((r) => r.routine.id === "body-mass")).toMatchObject({ state: "overdue", lastDoneDay: 1, nextDueDay: 8, daysLate: 7 });
    expect(d.find((r) => r.routine.id === "daily-checkin")).toMatchObject({ state: "overdue", lastDoneDay: 13 });
    const c = routineStatuses(journal(), "crew-c", TODAY);
    expect(c.find((r) => r.routine.id === "blood-pressure")).toMatchObject({ state: "overdue", daysLate: 5 });
    expect(c.find((r) => r.routine.id === "vision-check")).toMatchObject({ state: "due-today", nextDueDay: 15 });
  });

  it("marks a routine done today after completion", () => {
    const r = journalReducer(journal(), { type: "journal/complete-routine", crewId: "crew-d", routineId: "body-mass", note: "" }, ctx());
    expect(routineStatuses(r.state, "crew-d", TODAY).find((x) => x.routine.id === "body-mass")!.state).toBe("done-today");
    expect(r.audit[0]).toMatchObject({ module: "F01", kind: "action" });
  });

  it("never allows the daily check-in to be ticked as a routine", () => {
    const j = journal();
    const r = journalReducer(j, { type: "journal/complete-routine", crewId: "crew-a", routineId: "daily-checkin", note: "" }, ctx());
    expect(r.state).toBe(j);
  });

  it("uses demonstration intervals (not a NASA schedule)", () => {
    expect(ROUTINES.map((r) => r.everyDays)).toEqual([1, 7, 7, 14]);
  });
});

describe("attention flags (demonstration rules)", () => {
  it("raises the storyline flags of the seed", () => {
    const ids = (crew: Parameters<typeof journalFlags>[1]) => journalFlags(journal(), crew, TODAY).map((f) => f.id);
    expect(ids("crew-a")).toEqual([]);
    expect(ids("crew-b")).toEqual(["SHORT_SLEEP", "HIGH_FATIGUE", "SYMPTOM_REPORTED"]);
    expect(ids("crew-c")).toEqual(["LOW_HYDRATION", "SYMPTOM_REPORTED"]);
    expect(ids("crew-d")).toEqual(["CHECKIN_MISSING"]);
  });

  it("reports the days that triggered each flag", () => {
    const b = journalFlags(journal(), "crew-b", TODAY);
    expect(b.find((f) => f.id === "SHORT_SLEEP")!.days).toEqual([10, 11, 12, 13, 14]);
    expect(journalFlags(journal(), "crew-d", TODAY)[0].days).toEqual([12, 14]);
  });

  it("needs the full streak: two short nights are not enough", () => {
    const j: JournalData = { schemaVersion: 1, completions: [], checkIns: [] };
    let s = j;
    for (const [day, h] of [
      [12, 7.5],
      [13, 5],
      [14, 5],
    ] as const) {
      s = journalReducer(s, { type: "journal/submit-checkin", crewId: "crew-a", draft: draft({ sleepHours: h }) }, ctx(day)).state;
    }
    expect(journalFlags(s, "crew-a", 14).map((f) => f.id)).not.toContain("SHORT_SLEEP");
    s = journalReducer(s, { type: "journal/submit-checkin", crewId: "crew-a", draft: draft({ sleepHours: 5.5 }) }, ctx(15)).state;
    expect(journalFlags(s, "crew-a", 15).map((f) => f.id)).toContain("SHORT_SLEEP");
  });

  it("only looks at recent streaks", () => {
    // Crew B's short-sleep streak ended on day 14; four days later it is no longer current.
    expect(journalFlags(journal(), "crew-b", 18).map((f) => f.id)).not.toContain("SHORT_SLEEP");
  });

  it("words flags as follow-ups, never as a diagnosis or treatment", () => {
    const all = (["crew-a", "crew-b", "crew-c", "crew-d"] as const).flatMap((c) => journalFlags(journal(), c, TODAY));
    for (const f of all) {
      expect(f.detail).not.toMatch(/diagnos(is|ed)|disease|disorder|syndrome|medication|medicine|dose|treat/i);
    }
    expect(JOURNAL_RULES.status).toBe("PROVISIONAL");
    expect(JOURNAL_RULES.provenance).toMatch(/Not clinical criteria/);
  });
});

describe("check-in reducer", () => {
  it("records a crew check-in with time and source, and replaces the same-day entry", () => {
    let r = journalReducer(journal(), { type: "journal/submit-checkin", crewId: "crew-a", draft: draft() }, ctx());
    const first = todaysCheckIn(r.state, "crew-a", TODAY)!;
    expect(first).toMatchObject({ source: "crew-entry", at: { day: 15, minute: 480 }, crewId: "crew-a" });
    expect(r.audit[0].summary).toMatch(/^Recorded daily check-in for Crew Member A/);
    r = journalReducer(r.state, { type: "journal/submit-checkin", crewId: "crew-a", draft: draft({ sleepHours: 6.1 }) }, ctx(TODAY, 500));
    expect(r.state.checkIns.filter((c) => c.crewId === "crew-a" && c.at.day === TODAY)).toHaveLength(1);
    expect(todaysCheckIn(r.state, "crew-a", TODAY)!.sleepHours).toBe(6.1);
    expect(r.audit[0].summary).toMatch(/^Updated/);
  });

  it("logs a decision with the rule set version when a check-in raises a new flag", () => {
    const r = journalReducer(journal(), { type: "journal/submit-checkin", crewId: "crew-b", draft: draft({ sleepHours: 5, fatigue: 5 }) }, ctx());
    const decision = r.audit.find((a) => a.kind === "decision");
    expect(decision).toBeUndefined(); // flags already active from the seed → nothing new
    const r2 = journalReducer(journal(), { type: "journal/submit-checkin", crewId: "crew-a", draft: draft({ symptoms: ["headache"] }) }, ctx());
    expect(r2.audit.find((a) => a.kind === "decision")).toMatchObject({ refs: { ruleSet: JOURNAL_RULESET_REF, ruleIds: ["SYMPTOM_REPORTED"] } });
  });

  it("rejects out-of-range input without changing anything", () => {
    expect(validateCheckIn(draft({ sleepHours: 30 }))).toHaveLength(1);
    expect(validateCheckIn({ ...draft(), mood: 7 as 5 })).toHaveLength(1);
    expect(validateCheckIn(draft({ fluidIntakeL: -1 }))).toHaveLength(1);
    const j = journal();
    expect(journalReducer(j, { type: "journal/submit-checkin", crewId: "crew-a", draft: draft({ sleepHours: NaN }) }, ctx()).state).toBe(j);
  });

  it("queues a routine journal summary for Earth", () => {
    const r = journalReducer(journal(), { type: "journal/queue-summary", crewId: "crew-b" }, ctx());
    expect(r.outbox).toEqual([expect.objectContaining({ module: "F01", priority: "routine", title: "Journal summary — Crew Member B — day 15" })]);
    expect(r.outbox[0].summary).toMatch(/Short sleep reported/);
  });
});

describe("trends", () => {
  it("builds a 14-day series with gaps on missing days", () => {
    const s = metricSeries(journal().checkIns, "crew-d", "sleepHours", 2, 15);
    expect(s).toHaveLength(14);
    expect(s.filter((p) => p.value === null).map((p) => p.day)).toEqual([12, 14, 15]);
  });

  it("keeps only the latest check-in of a day", () => {
    const j = journal();
    const extra = { ...j.checkIns[0], id: "X", at: { day: 1, minute: 1000 }, sleepHours: 1 };
    const map = checkInsByDay([...j.checkIns, extra], j.checkIns[0].crewId);
    expect(map.get(1)!.id).toBe("X");
  });
});
