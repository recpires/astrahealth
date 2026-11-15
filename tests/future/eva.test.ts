/**
 * FUTURE 04 — EVA & Autonomous Response.
 */
import { describe, expect, it } from "vitest";
import protocol from "@/data/future/eva-protocol.json";
import { EMPTY_ASSESS, assessReducer, type AssessState } from "@/features/assess/reducer";
import { EVA_PROTOCOL, EVA_PROTOCOL_REF, INITIAL_EVA, checklistStatus, gateProposal, resolveStep, type EvaState } from "@/features/eva/logic";
import { evaReducer, type EvaAction } from "@/features/eva/reducer";
import { journalReducer } from "@/features/journal/reducer";
import type { JournalData } from "@/features/journal/types";
import { referenceById } from "@/features/platform/references";
import { seedJournal } from "@/features/platform/store";

const NOW = { day: 15, minute: 540 };
const LINK = { available: true, oneWayDelayMin: 12, since: NOW };
const checkIn = (j: JournalData, crewId: "crew-a" | "crew-c") =>
  journalReducer(j, { type: "journal/submit-checkin", crewId, draft: { sleepHours: 7, sleepQuality: 4, mood: 4, fatigue: 2, hydration: 4, fluidIntakeL: 2, symptoms: [], notes: "" } }, { now: { day: 15, minute: 480 }, newId: () => `CI-${crewId}` }).state;

function setup(opts: { journal?: JournalData; assess?: AssessState } = {}) {
  let n = 0;
  const ctx = { now: NOW, journal: opts.journal ?? checkIn(checkIn(seedJournal(), "crew-a"), "crew-c"), assess: opts.assess ?? EMPTY_ASSESS, link: LINK, newId: (p: string) => `${p}-${++n}` };
  let state: EvaState = INITIAL_EVA;
  const log: ReturnType<typeof evaReducer>[] = [];
  const run = (a: EvaAction) => {
    const r = evaReducer(state, a, ctx);
    log.push(r);
    state = r.state;
    return r;
  };
  return { ctx, run, get state() { return state; }, log };
}

const confirmPre = (run: (a: EvaAction) => unknown) => {
  for (const id of ["PRE-03", "PRE-04", "PRE-05", "PRE-06"]) run({ type: "eva/check", itemId: id });
};

describe("demonstration protocol", () => {
  it("is versioned, PROVISIONAL and not presented as a NASA procedure", () => {
    expect(EVA_PROTOCOL_REF).toBe("ASTRA-EVA@0.1.0-demo");
    expect(EVA_PROTOCOL.status).toBe("PROVISIONAL");
    expect(EVA_PROTOCOL.provenance).toMatch(/not NASA EVA procedures and are not validated/);
    for (const id of EVA_PROTOCOL.refIds) expect(referenceById(id)).toBeDefined();
  });

  it("has an alternative for every equipment-dependent step and no medication or treatment", () => {
    const steps = [...Object.values(EVA_PROTOCOL.checklists).flat(), ...EVA_PROTOCOL.events.flatMap((e) => e.steps)];
    const equipment = new Set(EVA_PROTOCOL.equipment.map((e) => e.id));
    for (const s of steps.filter((x) => x.requires)) {
      expect(equipment.has(s.requires!), s.id).toBe(true);
      expect(s.alternative, s.id).toBeTruthy();
    }
    const { checklists, events } = protocol;
    expect(JSON.stringify({ checklists, events }).toLowerCase()).not.toMatch(/medication|medicine|\bdrugs?\b|\bdoses?\b|inject|prescri|treat|diagnos/);
  });

  it("switches a step to its alternative when the equipment is unavailable", () => {
    const step = EVA_PROTOCOL.checklists.pre.find((s) => s.id === "PRE-04")!;
    expect(resolveStep(step, { "suit-telemetry": true })).toMatchObject({ usesAlternative: false, text: step.text });
    expect(resolveStep(step, { "suit-telemetry": false })).toMatchObject({ usesAlternative: true, text: step.alternative, missingEquipment: "Suit biomedical telemetry" });
  });
});

describe("pre-EVA gate (system proposes, commander decides)", () => {
  it("plans an EVA for exactly two crew members", () => {
    const t = setup();
    expect(t.run({ type: "eva/plan", crew: ["crew-a"] }).state.session).toBeNull();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    expect(t.state.session).toMatchObject({ phase: "pre", crew: ["crew-a", "crew-c"] });
  });

  it("proposes HOLD until every pre-EVA item is satisfied, then GO", () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    expect(gateProposal(t.state.session!, t.state.equipment, t.ctx)).toMatchObject({ proposal: "hold" });
    confirmPre(t.run);
    expect(gateProposal(t.state.session!, t.state.equipment, t.ctx)).toEqual({ proposal: "go", reasons: [] });
  });

  it("uses FUTURE 01 and FUTURE 02 data in its automatic checks", () => {
    // Crew B has no check-in today and a severe-symptom assessment holding EVA.
    const assess = assessReducer(EMPTY_ASSESS, { type: "assess/submit", input: { crewId: "crew-b", symptom: "dizziness", severity: "severe", onset: "sudden", trend: "unchanged", durationHours: 2, canPerformDuties: true, warningSigns: [], notes: "" } }, { now: NOW, journal: seedJournal(), newId: () => "SA-1" }).state;
    const t = setup({ assess });
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-b"] });
    confirmPre(t.run);
    const g = gateProposal(t.state.session!, t.state.equipment, t.ctx);
    expect(g.proposal).toBe("hold");
    expect(g.reasons.join(" ")).toMatch(/PRE-01: No check-in today: Crew Member B/);
    expect(g.reasons.join(" ")).toMatch(/PRE-02: Held by assessment SA-1 \(Crew Member B\)/);
  });

  it("requires a reason to decide against the proposal and logs the override", () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    expect(t.run({ type: "eva/gate", decision: "go", by: "Commander", reason: "" }).state.session!.phase).toBe("pre");
    const r = t.run({ type: "eva/gate", decision: "go", by: "Commander", reason: "Checks done verbally" });
    expect(t.state.session!.phase).toBe("during");
    expect(t.state.session!.gates).toHaveLength(1);
    expect(t.state.session!.gates[0]).toMatchObject({ proposal: "hold", decision: { choice: "go", override: true, reason: "Checks done verbally" } });
    expect(r.audit[0].summary).toMatch(/system proposed HOLD.*decided GO — OVERRIDE/);
    expect(r.audit[0].refs!.ruleSet).toBe(EVA_PROTOCOL_REF);
  });

  it("accepts a HOLD that matches the proposal without a reason and stays in pre-EVA", () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    t.run({ type: "eva/gate", decision: "hold", by: "Commander", reason: "" });
    expect(t.state.session).toMatchObject({ phase: "pre", gates: [{ decision: { choice: "hold", override: false } }] });
  });
});

describe("during the EVA", () => {
  const start = () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    confirmPre(t.run);
    t.run({ type: "eva/gate", decision: "go", by: "Commander", reason: "" });
    return t;
  };

  it("applies the event protocol, queues a prioritised report and waits for the commander", () => {
    const t = start();
    const r = t.run({ type: "eva/event", eventId: "EV-UNWELL" });
    const rec = t.state.session!.events[0];
    expect(rec).toMatchObject({ eventId: "EV-UNWELL", proposal: "terminate", decision: null });
    expect(r.outbox[0]).toMatchObject({ module: "F04", priority: "urgent" });
    expect(r.audit[0]).toMatchObject({ kind: "decision", refs: { ruleSet: EVA_PROTOCOL_REF } });
  });

  it("marks equipment lost by an event and uses alternatives from then on", () => {
    const t = start();
    t.run({ type: "eva/event", eventId: "EV-TELEMETRY-LOST" });
    expect(t.state.equipment["suit-telemetry"]).toBe(false);
    t.run({ type: "eva/event", eventId: "EV-UNWELL" });
    expect(t.state.session!.events[1].steps.find((s) => s.id === "U3")).toMatchObject({ usesAlternative: true });
    const during = checklistStatus("during", t.state.session!, t.state.equipment, t.ctx);
    expect(during.find((c) => c.item.id === "DUR-02")!.item.usesAlternative).toBe(true);
  });

  it("asks the platform to mark the Earth link lost on EV-LINK-LOST", () => {
    const t = start();
    expect(t.run({ type: "eva/event", eventId: "EV-LINK-LOST" }).effects).toEqual({ setLinkAvailable: false });
  });

  it("ends the EVA when the commander follows a terminate proposal; override needs a reason", () => {
    const t = start();
    t.run({ type: "eva/event", eventId: "EV-UNWELL" });
    const id = t.state.session!.events[0].id;
    expect(t.run({ type: "eva/decide", recordId: id, choice: "continue", by: "Commander", reason: "" }).state.session!.events[0].decision).toBeNull();
    t.run({ type: "eva/decide", recordId: id, choice: "terminate", by: "Commander", reason: "" });
    expect(t.state.session).toMatchObject({ phase: "post", endedAt: NOW });
    expect(t.state.session!.events[0].decision).toMatchObject({ choice: "terminate", override: false });
  });
});

describe("post-EVA and closure", () => {
  it("queues the EVA log, then closes only with all items done or a reason", () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    confirmPre(t.run);
    t.run({ type: "eva/gate", decision: "go", by: "Commander", reason: "" });
    t.run({ type: "eva/end" });
    expect(t.run({ type: "eva/close", by: "Commander", reason: "" }).state.session).not.toBeNull();
    const log = t.run({ type: "eva/queue-log" });
    expect(log.outbox[0]).toMatchObject({ priority: "routine", title: expect.stringMatching(/^EVA EVA-1 log/) });
    t.run({ type: "eva/check", itemId: "POST-01" });
    t.run({ type: "eva/check", itemId: "POST-02" });
    t.run({ type: "eva/close", by: "Commander", reason: "" });
    expect(t.state.session).toBeNull();
    expect(t.state.history[0]).toMatchObject({ phase: "closed", logQueued: true });
  });

  it("rejects checklist items from another phase", () => {
    const t = setup();
    t.run({ type: "eva/plan", crew: ["crew-a", "crew-c"] });
    const before = t.state;
    expect(t.run({ type: "eva/check", itemId: "POST-01" }).state).toBe(before);
    expect(t.run({ type: "eva/check", itemId: "PRE-01" }).state).toBe(before); // automatic item
  });
});
