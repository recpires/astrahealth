/**
 * FUTURE 02 — Symptom Assessment & Evidence Engine.
 */
import { describe, expect, it } from "vitest";
import ruleset from "@/data/future/symptom-ruleset.json";
import {
  SYMPTOM_RULESET,
  SYMPTOM_RULESET_CHECKSUM,
  SYMPTOM_RULESET_REF,
  assessSymptom,
  matchRules,
  ruleFacts,
  validateAssessmentInput,
  type AssessmentInput,
} from "@/features/assess/engine";
import { assessReducer, EMPTY_ASSESS, evaHoldingAssessments } from "@/features/assess/reducer";
import { checksumOf } from "@/features/platform/checksum";
import { referenceById } from "@/features/platform/references";
import { seedJournal } from "@/features/platform/store";

const TODAY = 15;
const input = (over: Partial<AssessmentInput> = {}): AssessmentInput => ({
  crewId: "crew-a",
  symptom: "headache",
  severity: "mild",
  onset: "gradual",
  trend: "unchanged",
  durationHours: 4,
  canPerformDuties: true,
  warningSigns: [],
  notes: "",
  ...over,
});
const ctx = () => {
  let n = 0;
  return { now: { day: TODAY, minute: 600 }, journal: seedJournal(), newId: (p: string) => `${p}-T${++n}` };
};

describe("versioned rule set", () => {
  it("is identified, versioned and marked PROVISIONAL", () => {
    expect(SYMPTOM_RULESET_REF).toBe("ASTRA-SYM@0.1.0-demo");
    expect(SYMPTOM_RULESET.status).toBe("PROVISIONAL");
    expect(SYMPTOM_RULESET.provenance).toMatch(/not clinical criteria, not a NASA protocol and not validated/);
    expect(SYMPTOM_RULESET_CHECKSUM).toBe(checksumOf(ruleset));
  });

  it("references only steps and NASA references that exist", () => {
    const steps = new Set(SYMPTOM_RULESET.steps.map((s) => s.id));
    for (const r of SYMPTOM_RULESET.rules) for (const s of r.steps) expect(steps.has(s), `${r.id} → ${s}`).toBe(true);
    const refs = [...SYMPTOM_RULESET.evidenceMap.always, ...Object.values(SYMPTOM_RULESET.evidenceMap.bySymptom).flat()];
    for (const id of refs) expect(referenceById(id), id).toBeDefined();
  });

  it("never names a condition, a medication or a treatment in what it shows or proposes", () => {
    const { levels, warningSigns, steps, rules } = SYMPTOM_RULESET;
    const text = JSON.stringify({ levels, warningSigns, steps, rules }).toLowerCase();
    const banned = /diagnos|disease|syndrome|stroke|infarct|embolism|migraine|infection|medication|medicine|\bdrugs?\b|\bdoses?\b|\bmg\b|ibuprofen|aspirin|paracetamol|acetaminophen|inject|prescri|treat/;
    expect(text.match(banned)).toBeNull();
    // The disclaimer itself says so explicitly.
    expect(SYMPTOM_RULESET.provenance).toMatch(/never name a condition, a medication or a treatment/);
  });
});

describe("rule matching", () => {
  it("always matches the baseline rule", () => {
    expect(matchRules(ruleFacts(input(), seedJournal(), TODAY)).map((r) => r.id)).toEqual(["SYM-R00"]);
  });

  it("matches each rule on its own condition", () => {
    const ids = (o: Partial<AssessmentInput>) => matchRules(ruleFacts(input(o), seedJournal(), TODAY)).map((r) => r.id);
    expect(ids({ warningSigns: ["fainting"] })).toContain("SYM-R01");
    expect(ids({ severity: "severe" })).toContain("SYM-R02");
    expect(ids({ canPerformDuties: false })).toContain("SYM-R03");
    expect(ids({ symptom: "vision-change" })).toContain("SYM-R04");
    expect(ids({ trend: "worsening" })).toContain("SYM-R05");
    expect(ids({ severity: "moderate" })).toContain("SYM-R06");
    expect(ids({ durationHours: 48 })).toContain("SYM-R07");
    expect(ids({ durationHours: 47.9 })).not.toContain("SYM-R07");
    expect(ids({ symptom: "nausea" })).toContain("SYM-R09");
    expect(ids({ canPerformDuties: null })).not.toContain("SYM-R03");
  });

  it("uses the journal: a symptom reported on 3+ of the last 7 days matches SYM-R08", () => {
    const j = seedJournal();
    // Crew B reported trouble sleeping on days 13 and 14 → 2 days.
    expect(ruleFacts(input({ crewId: "crew-b", symptom: "trouble-sleeping" }), j, TODAY).journalDays).toBe(2);
    const more = { ...j, checkIns: [...j.checkIns, { ...j.checkIns.find((c) => c.crewId === "crew-b" && c.at.day === 14)!, id: "x", at: { day: 15, minute: 470 } }] };
    expect(matchRules(ruleFacts(input({ crewId: "crew-b", symptom: "trouble-sleeping" }), more, TODAY)).map((r) => r.id)).toContain("SYM-R08");
  });
});

describe("assessment output", () => {
  it("takes the highest level of the matched rules and lists its steps first, each once", () => {
    const o = assessSymptom(input({ severity: "severe", trend: "worsening" }), seedJournal(), TODAY);
    expect(o.level).toBe("support-recommended");
    expect(o.steps[0].id).toBe("CMO");
    expect(new Set(o.steps.map((s) => s.id)).size).toBe(o.steps.length);
    expect(o.steps.map((s) => s.id)).toEqual(expect.arrayContaining(["EARTH-PRIORITY", "NO-EVA", "LOG"]));
    expect(o).toMatchObject({ supportSuggested: true, suggestedPriority: "priority", ruleSet: SYMPTOM_RULESET_REF });
  });

  it("asks for medical support now when a warning sign is present", () => {
    const o = assessSymptom(input({ warningSigns: ["chest-discomfort"] }), seedJournal(), TODAY);
    expect(o.level).toBe("support-now");
    expect(o.suggestedPriority).toBe("urgent");
    expect(o.steps.map((s) => s.id)).toContain("EARTH-URGENT");
  });

  it("keeps a mild, stable symptom at monitor level without a report priority", () => {
    const o = assessSymptom(input(), seedJournal(), TODAY);
    expect(o).toMatchObject({ level: "monitor", supportSuggested: false, suggestedPriority: null });
  });

  it("shows verified excerpts word for word, and reference-only entries without content", () => {
    const o = assessSymptom(input({ symptom: "dizziness" }), seedJournal(), TODAY);
    const cardio = o.evidence.scientific.find((s) => s.refId === "hrr-179")!;
    expect(cardio.level).toBe("verified-excerpts");
    expect(cardio.excerpt!.text.length).toBeGreaterThan(40);
    const sensorimotor = o.evidence.scientific.find((s) => s.refId === "hrr-88")!;
    expect(sensorimotor).toMatchObject({ level: "reference-only", excerpt: null });
    expect(o.evidence.association).toMatch(/chosen by Team ANGARIS; it is not a NASA statement/);
  });

  it("states uncertainty and never reports it as low", () => {
    const complete = assessSymptom(input({ symptom: "trouble-sleeping" }), seedJournal(), TODAY);
    expect(complete.uncertainty.level).toBe("moderate");
    expect(complete.uncertainty.reasons.at(-1)).toMatch(/never reported as low/);
    const sparse = assessSymptom(input({ onset: "unknown", trend: "unknown", durationHours: null }), seedJournal(), TODAY);
    expect(sparse.uncertainty.level).toBe("high");
    expect(sparse.uncertainty.reasons[0]).toBe("Not answered: onset, trend, duration.");
    const noRef = assessSymptom(input({ symptom: "headache" }), seedJournal(), TODAY);
    expect(noRef.uncertainty.level).toBe("high");
    expect(noRef.uncertainty.reasons.join(" ")).toMatch(/No symptom-specific NASA reference/);
  });

  it("is deterministic: same inputs → same output and checksum", () => {
    expect(assessSymptom(input(), seedJournal(), TODAY)).toEqual(assessSymptom(input(), seedJournal(), TODAY));
    expect(assessSymptom(input(), seedJournal(), TODAY).inputChecksum).not.toBe(assessSymptom(input({ severity: "moderate" }), seedJournal(), TODAY).inputChecksum);
  });

  it("validates input", () => {
    expect(validateAssessmentInput(input({ durationHours: -1 }))).toHaveLength(1);
    expect(validateAssessmentInput(input({ warningSigns: ["made-up"] }))).toHaveLength(1);
    expect(validateAssessmentInput(input({ symptom: "x" as "headache" }))).toHaveLength(1);
  });
});

describe("assessment reducer — human in the loop and traceability", () => {
  it("records the decision with rule ids, evidence ids and input checksum", () => {
    const r = assessReducer(EMPTY_ASSESS, { type: "assess/submit", input: input({ symptom: "dizziness", severity: "moderate" }) }, ctx());
    const rec = r.state.records[0];
    expect(rec.review).toBeNull();
    expect(r.audit[0]).toMatchObject({ module: "F02", kind: "decision", refs: { ruleSet: SYMPTOM_RULESET_REF, recordId: rec.id, inputChecksum: rec.output.inputChecksum } });
    expect(r.audit[0].refs!.ruleIds).toEqual(rec.output.matchedRules.map((m) => m.id));
    expect(r.audit[1]).toMatchObject({ kind: "evidence", refs: { evidenceIds: ["hrr-179", "hrr-88", "hrr-95", "hrr-175"] } });
  });

  it("requires a note to override, and accepts only one review", () => {
    const c = ctx();
    let s = assessReducer(EMPTY_ASSESS, { type: "assess/submit", input: input() }, c).state;
    const id = s.records[0].id;
    expect(assessReducer(s, { type: "assess/review", recordId: id, decision: "overridden", by: "CMO", note: " " }, c).state).toBe(s);
    s = assessReducer(s, { type: "assess/review", recordId: id, decision: "overridden", by: "CMO", note: "Seen in person" }, c).state;
    expect(s.records[0].review).toMatchObject({ decision: "overridden", note: "Seen in person" });
    expect(assessReducer(s, { type: "assess/review", recordId: id, decision: "accepted", by: "CMO", note: "" }, c).state).toBe(s);
  });

  it("queues a report once, with the priority suggested by the level", () => {
    const c = ctx();
    let r = assessReducer(EMPTY_ASSESS, { type: "assess/submit", input: input({ warningSigns: ["breathing"] }) }, c);
    const id = r.state.records[0].id;
    r = assessReducer(r.state, { type: "assess/queue-report", recordId: id }, c);
    expect(r.outbox[0]).toMatchObject({ module: "F02", priority: "urgent", recordId: id });
    expect(r.outbox[0].summary).toMatch(/ASTRA-SYM@0.1.0-demo \(SYM-R00, SYM-R01\)/);
    expect(assessReducer(r.state, { type: "assess/queue-report", recordId: id }, c).outbox).toHaveLength(0);
  });

  it("holds EVA participation for two mission days when NO-EVA is proposed", () => {
    const r = assessReducer(EMPTY_ASSESS, { type: "assess/submit", input: input({ crewId: "crew-b", severity: "severe" }) }, ctx());
    expect(evaHoldingAssessments(r.state, "crew-b", TODAY)).toHaveLength(1);
    expect(evaHoldingAssessments(r.state, "crew-b", TODAY + 1)).toHaveLength(1);
    expect(evaHoldingAssessments(r.state, "crew-b", TODAY + 2)).toHaveLength(0);
    expect(evaHoldingAssessments(r.state, "crew-a", TODAY)).toHaveLength(0);
  });
});
