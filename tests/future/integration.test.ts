/**
 * Integration of the FUTURE modules through the platform store:
 * journal → assessment → EVA gate → readiness, Earth link loss and recovery,
 * traceability of every step, persistence, and isolation from the tested demo.
 */
import { describe, expect, it } from "vitest";
import { verifyAuditChain } from "@/features/platform/audit";
import { loadFutureState, saveFutureState } from "@/features/platform/storage";
import { createFutureState, futureReducer, type FutureAction, type FutureState } from "@/features/platform/store";
import { gateProposal } from "@/features/eva/logic";
import { crewReadiness, systemVerification } from "@/features/readiness/logic";
import { createInitialState, missionReducer } from "@/lib/mission/reducer";
import { memoryStorage } from "./helpers";

const play = (actions: FutureAction[], s: FutureState = createFutureState()) => actions.reduce(futureReducer, s);
const checkIn = (crewId: "crew-a" | "crew-b" | "crew-c" | "crew-d", over: Record<string, unknown> = {}): FutureAction => ({
  type: "journal/submit-checkin",
  crewId,
  draft: { sleepHours: 7.4, sleepQuality: 4, mood: 4, fatigue: 2, hydration: 4, fluidIntakeL: 2.2, symptoms: [], notes: "", ...over },
});

describe("end-to-end flow across modules (domain level)", () => {
  it("journal symptom → assessment hold → EVA HOLD proposal → override with reason → full trace", () => {
    let s = play([
      checkIn("crew-a"),
      checkIn("crew-c", { symptoms: ["dizziness"] }),
      { type: "assess/submit", input: { crewId: "crew-c", symptom: "dizziness", severity: "severe", onset: "sudden", trend: "worsening", durationHours: 1, canPerformDuties: false, warningSigns: [], notes: "" } },
    ]);
    const rec = s.assess.records[0];
    expect(rec.output.level).toBe("support-recommended");
    expect(rec.output.evidence.local.join(" ")).toMatch(/reported by Crew Member C on 1 of the last 7 days/);

    s = play([{ type: "assess/review", recordId: rec.id, decision: "accepted", by: "CMO", note: "" }, { type: "eva/plan", crew: ["crew-a", "crew-c"] }], s);
    for (const id of ["PRE-03", "PRE-04", "PRE-05", "PRE-06"]) s = futureReducer(s, { type: "eva/check", itemId: id });
    const ctx = { now: s.platform.clock, journal: s.journal, assess: s.assess, link: s.platform.link };
    expect(gateProposal(s.eva.session!, s.eva.equipment, ctx)).toMatchObject({ proposal: "hold", reasons: [expect.stringMatching(/^PRE-02: Held by assessment/)] });

    s = futureReducer(s, { type: "eva/gate", decision: "hold", by: "Commander", reason: "" });
    expect(s.eva.session!.phase).toBe("pre");
    expect(crewReadiness(s, "crew-c", null).items.find((i) => i.id === "R-F04-EVA")!.status).toBe("attention");

    const modules = new Set(s.platform.audit.map((a) => a.module));
    expect([...modules]).toEqual(expect.arrayContaining(["PLATFORM", "F01", "F02", "F04"]));
    expect(verifyAuditChain(s.platform.audit).ok).toBe(true);
    const decisions = s.platform.audit.filter((a) => a.kind === "decision");
    expect(decisions.every((d) => d.refs?.ruleSet)).toBe(true);
    expect(s.platform.audit.find((a) => a.kind === "evidence")!.refs!.evidenceIds).toEqual(["hrr-179", "hrr-88", "hrr-95", "hrr-175"]);
  });
});

describe("communication loss (offline operation)", () => {
  it("every module keeps working while the Earth link is lost, and reports sync in priority order afterwards", () => {
    let s = play([{ type: "platform/set-link", available: false }]);
    s = play(
      [
        checkIn("crew-d"),
        { type: "journal/complete-routine", crewId: "crew-d", routineId: "body-mass", note: "" },
        { type: "journal/queue-summary", crewId: "crew-d" },
        { type: "profile/add-entry", crewId: "crew-d", metricId: "body-mass", value: 84.9, quality: "good", note: "" },
        { type: "assess/submit", input: { crewId: "crew-d", symptom: "back-pain", severity: "moderate", onset: "gradual", trend: "unchanged", durationHours: 20, canPerformDuties: true, warningSigns: [], notes: "" } },
        { type: "assess/submit", input: { crewId: "crew-a", symptom: "nausea", severity: "mild", onset: "sudden", trend: "worsening", durationHours: 1, canPerformDuties: true, warningSigns: ["fainting"], notes: "" } },
      ],
      s,
    );
    s = play([{ type: "assess/queue-report", recordId: s.assess.records[0].id }, { type: "assess/queue-report", recordId: s.assess.records[1].id }, { type: "platform/advance", minutes: 90 }], s);

    expect(s.journal.checkIns.some((c) => c.crewId === "crew-d" && c.at.day === 15)).toBe(true);
    expect(s.profile.entries.at(-1)!.value).toBe(84.9);
    expect(s.platform.outbox.map((m) => [m.priority, m.state])).toEqual([
      ["routine", "queued"],
      ["routine", "queued"],
      ["urgent", "queued"],
    ]);

    s = futureReducer(s, { type: "platform/set-link", available: true });
    const sent = [...s.platform.outbox].sort((a, b) => a.sendOrder! - b.sendOrder!);
    expect(sent.map((m) => m.priority)).toEqual(["urgent", "routine", "routine"]);
    expect(sent.every((m) => m.state === "sent" && m.sentAt!.minute === s.platform.clock.minute)).toBe(true);

    s = futureReducer(s, { type: "platform/advance", minutes: 24 });
    expect(s.platform.outbox.every((m) => m.state === "acknowledged")).toBe(true);
    expect(systemVerification(s, { storageWritable: true }).find((c) => c.id === "V-AUDIT")!.ok).toBe(true);
  });

  it("an EVA event 'Earth link lost' switches the platform link off and is traced", () => {
    let s = play([checkIn("crew-a"), checkIn("crew-c"), { type: "eva/plan", crew: ["crew-a", "crew-c"] }]);
    for (const id of ["PRE-03", "PRE-04", "PRE-05", "PRE-06"]) s = futureReducer(s, { type: "eva/check", itemId: id });
    s = play([{ type: "eva/gate", decision: "go", by: "Commander", reason: "" }, { type: "eva/event", eventId: "EV-LINK-LOST" }], s);
    expect(s.platform.link.available).toBe(false);
    expect(s.platform.outbox.at(-1)).toMatchObject({ module: "F04", state: "queued", priority: "routine" });
    expect(s.platform.audit.some((a) => /Earth link LOST/.test(a.summary))).toBe(true);
  });
});

describe("persistence across a reload", () => {
  it("restores every module, the trail and the queue exactly", () => {
    const store = memoryStorage();
    const s = play([checkIn("crew-b"), { type: "platform/set-link", available: false }, { type: "journal/queue-summary", crewId: "crew-b" }, { type: "platform/advance", minutes: 30 }]);
    saveFutureState(store, s);
    const back = loadFutureState(store);
    expect(back.state).toEqual(s);
    expect(verifyAuditChain(back.state.platform.audit).ok).toBe(true);
    // continuing after the reload keeps identifiers unique
    const next = futureReducer(back.state, { type: "journal/queue-summary", crewId: "crew-a" });
    const ids = next.platform.outbox.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isolation from the tested three-scenario demo", () => {
  it("FUTURE actions never touch the mission simulation state", () => {
    const mission = missionReducer(createInitialState(), { type: "START_SCENARIO", scenarioId: "vital-deviation" });
    const snapshot = JSON.stringify(mission);
    play([checkIn("crew-a"), { type: "platform/set-link", available: false }, { type: "platform/next-day" }]);
    expect(JSON.stringify(mission)).toBe(snapshot);
  });
});
