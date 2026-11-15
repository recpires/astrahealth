/**
 * FUTURE 05 — Verification & Mission Readiness.
 */
import { describe, expect, it } from "vitest";
import { createFutureState, futureReducer, type FutureAction, type FutureState } from "@/features/platform/store";
import { crewReadiness, readinessSummary, ruleSets, systemVerification } from "@/features/readiness/logic";

const play = (actions: FutureAction[], s: FutureState = createFutureState()) => actions.reduce(futureReducer, s);
const checkIn = (crewId: "crew-a" | "crew-b" | "crew-c" | "crew-d", sleepHours = 7.4): FutureAction => ({
  type: "journal/submit-checkin",
  crewId,
  draft: { sleepHours, sleepQuality: 4, mood: 4, fatigue: 2, hydration: 4, fluidIntakeL: 2.2, symptoms: [], notes: "" },
});

describe("crew data & procedure readiness", () => {
  it("is incomplete for everyone at 08:00 on day 15 (no check-in yet)", () => {
    const r = readinessSummary(createFutureState(), null);
    expect(r.map((c) => c.overall)).toEqual(["incomplete", "incomplete", "incomplete", "incomplete"]);
    expect(r[0].items.find((i) => i.id === "R-F01-CHECKIN")).toMatchObject({ status: "missing" });
  });

  it("lists what needs attention per module", () => {
    const b = crewReadiness(play([checkIn("crew-b", 5.1)]), "crew-b", null);
    expect(b.overall).toBe("attention");
    expect(b.items.find((i) => i.id === "R-F01-FLAGS")!.detail).toMatch(/Short sleep reported/);
    // A good night today ends the short-sleep streak, so that flag clears.
    const rested = crewReadiness(play([checkIn("crew-b", 7.6)]), "crew-b", null);
    expect(rested.items.find((i) => i.id === "R-F01-FLAGS")!.detail).not.toMatch(/Short sleep/);
    const d = crewReadiness(play([checkIn("crew-d")]), "crew-d", null);
    expect(d.items.find((i) => i.id === "R-F01-ROUTINES")!.detail).toMatch(/Body mass measurement \(7 d\)/);
  });

  it("flags unreviewed assessments and EVA holds", () => {
    const s = play([
      checkIn("crew-a"),
      { type: "assess/submit", input: { crewId: "crew-a", symptom: "nausea", severity: "severe", onset: "sudden", trend: "unchanged", durationHours: 1, canPerformDuties: true, warningSigns: [], notes: "" } },
    ]);
    const a = crewReadiness(s, "crew-a", null);
    expect(a.items.find((i) => i.id === "R-F02-REVIEW")).toMatchObject({ status: "attention" });
    expect(a.items.find((i) => i.id === "R-F04-EVA")!.detail).toMatch(/EVA participation held by SA-/);
  });

  it("counts profile coverage and never counts unavailable exams as data", () => {
    const a = crewReadiness(createFutureState(), "crew-a", null);
    expect(a.items.find((i) => i.id === "R-F03-COVERAGE")!.detail).toMatch(/11 need equipment not available \(no data, never estimated\)/);
  });

  it("is labelled as not being a medical clearance (in the UI) — the logic returns data status only", () => {
    const statuses = new Set(readinessSummary(createFutureState(), null).flatMap((c) => c.items.map((i) => i.status)));
    for (const s of statuses) expect(["ok", "attention", "missing"]).toContain(s);
  });
});

describe("system verification", () => {
  it("passes on the demo state", () => {
    const checks = systemVerification(createFutureState(), { storageWritable: true });
    expect(checks.map((c) => [c.id, c.ok])).toEqual([
      ["V-AUDIT", true],
      ["V-VERSIONED", true],
      ["V-NOT-VALIDATED", true],
      ["V-REFERENCES", true],
      ["V-HUMAN", true],
      ["V-OFFLINE", true],
      ["V-STORAGE", true],
    ]);
  });

  it("detects a tampered audit trail", () => {
    const s = play([checkIn("crew-a"), checkIn("crew-b")]);
    const tampered: FutureState = { ...s, platform: { ...s.platform, audit: s.platform.audit.map((e, i) => (i === 1 ? { ...e, summary: "edited" } : e)) } };
    const audit = systemVerification(tampered, { storageWritable: true }).find((c) => c.id === "V-AUDIT")!;
    expect(audit).toMatchObject({ ok: false });
    expect(audit.detail).toMatch(/Entry #2: entry content changed after it was recorded/);
  });

  it("reports proposals still waiting for a human decision", () => {
    const s = play([{ type: "assess/submit", input: { crewId: "crew-c", symptom: "headache", severity: "mild", onset: "gradual", trend: "unchanged", durationHours: 3, canPerformDuties: true, warningSigns: [], notes: "" } }]);
    expect(systemVerification(s, { storageWritable: true }).find((c) => c.id === "V-HUMAN")).toMatchObject({ ok: false });
  });

  it("lists four versioned, PROVISIONAL rule sets with checksums", () => {
    const sets = ruleSets();
    expect(sets.map((r) => r.ref)).toEqual(["ASTRA-JOURNAL@0.1.0-demo", "ASTRA-SYM@0.1.0-demo", "ASTRA-PROFILE@0.1.0-demo", "ASTRA-EVA@0.1.0-demo"]);
    expect(sets.every((r) => r.status === "PROVISIONAL" && /^[0-9a-f]{16}$/.test(r.checksum))).toBe(true);
  });

  it("reports blocked storage", () => {
    expect(systemVerification(createFutureState(), { storageWritable: false }).find((c) => c.id === "V-STORAGE")!.ok).toBe(false);
  });
});
