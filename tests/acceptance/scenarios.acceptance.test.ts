/**
 * Acceptance tests for the three demonstration scenarios.
 *
 * Each test maps to one case of tests/acceptance/test-plan.json (same ID) and
 * records the values it actually observed. When ASTRA_TEST_EVIDENCE is set
 * (npm run test:evidence), the observations are written to that file and
 * used by scripts/build-test-report.mjs to produce docs/TEST_REPORT.md.
 *
 * Everything runs on the pure mission reducer: deterministic, no browser, no network.
 */
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { REFERENCE_CONFIG } from "@/config/reference-ranges";
import { vitalsNeedingConfirmation } from "@/lib/analysis/confirmation";
import { messageStatus, messageTimeline, type MessageState } from "@/lib/comms/queue";
import {
  buildReportFromState,
  createInitialState,
  deriveView,
  isPlaybackComplete,
  missionReducer,
  type MissionAction,
  type MissionState,
} from "@/lib/mission/reducer";
import { PROCEDURES } from "@/lib/response/procedures";
import { reportToText } from "@/lib/report/incident-report";
import { SCENARIOS } from "@/lib/scenarios";
import { formatDuration } from "@/lib/time";
import { VITAL_KEYS, type ScenarioId, type VitalKey } from "@/lib/types";

// ---------------------------------------------------------------------------
// Evidence recording
// ---------------------------------------------------------------------------

const evidence: Record<string, Record<string, unknown>> = {};
/** Records what was observed (called BEFORE the assertions so failures keep their observations). */
function observe(id: string, summary: string, data: Record<string, unknown>) {
  evidence[id] = { summary, ...data };
}

afterAll(() => {
  const out = process.env.ASTRA_TEST_EVIDENCE;
  if (!out) return;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedBy: "tests/acceptance/scenarios.acceptance.test.ts", cases: evidence }, null, 2) + "\n");
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const run = (s: MissionState, ...actions: MissionAction[]) => actions.reduce(missionReducer, s);
const tick = (s: MissionState) => missionReducer(s, { type: "TICK", dtRealSec: 1 });
function advance(s: MissionState, missionSeconds: number): MissionState {
  for (let i = 0; i < Math.ceil(missionSeconds / s.timeScale); i++) s = tick(s);
  return s;
}
function start(id: ScenarioId): MissionState {
  return run(createInitialState(), { type: "START_SCENARIO", scenarioId: id });
}
function playToEnd(id: ScenarioId): MissionState {
  const sc = SCENARIOS[id];
  return advance(start(id), sc.samples.length * sc.sampleIntervalSec);
}
/** Mission time relative to the scenario start, e.g. "+1 min 30 s". */
const rel = (s: MissionState, t: number) => `+${formatDuration(t - s.anchorClock)}`;
const onsetTime = (s: MissionState, id: ScenarioId) =>
  s.anchorClock + ((SCENARIOS[id].incidentOnsetIndex ?? 0) - s.anchorTick) * SCENARIOS[id].sampleIntervalSec;

/** Advances until a message reaches each state; returns the first mission time each state was seen (relative to queueing). */
function followMessage(s: MissionState, index: number, untilState: MessageState = "response-received") {
  const seen: Partial<Record<MessageState, string>> = {};
  const queuedAt = s.comms.messages[index].createdAt;
  // A message that is still waiting has been "queued" since it was created.
  if (messageStatus(s.comms.messages[index], s.clock).state === "queued") seen.queued = "+0 s";
  for (let i = 0; i < 20_000; i++) {
    const st = messageStatus(s.comms.messages[index], s.clock).state;
    if (!seen[st]) seen[st] = `+${formatDuration(s.clock - queuedAt)}`;
    if (st === untilState) break;
    s = missionReducer(s, { type: "TICK", dtRealSec: 0.1 });
  }
  return { state: s, seen };
}

const DIAGNOSTIC_TERMS = ["tachycardia", "hypoxemia", "hypoxaemia", "arrhythmia", "fever", "infection", "diagnosed"];
const TREATMENT_TERMS = ["medication", "medicine", "drug", "dose", "mg", "inject", "administer", "tablet", "pill", "defibrillat", "cpr"];

// ---------------------------------------------------------------------------
// Scenario 1 — Nominal monitoring
// ---------------------------------------------------------------------------

describe("Scenario 1 — Nominal monitoring", () => {
  it("S1-01 MEASURE: vital signs stay inside the demo ranges and all sensors are online", () => {
    let s = start("nominal");
    const range: Record<VitalKey, [number, number]> = { hr: [Infinity, -Infinity], spo2: [Infinity, -Infinity], temp: [Infinity, -Infinity] };
    let outOfRange = 0;
    let sensorsNotOnline = 0;
    for (let i = 0; i < 400; i++) {
      s = tick(s);
      for (const k of VITAL_KEYS) {
        const v = s.analysis.sensors[k].lastValue!;
        range[k] = [Math.min(range[k][0], v), Math.max(range[k][1], v)];
        const n = REFERENCE_CONFIG.vitals[k].normal;
        if (v < n[0] || v > n[1]) outOfRange++;
        if (s.analysis.sensors[k].status !== "online") sensorsNotOnline++;
      }
    }
    observe("S1-01", `400 samples: ${outOfRange} outside the demo ranges (HR ${range.hr[0]}–${range.hr[1]} bpm, SpO₂ ${range.spo2[0]}–${range.spo2[1]} %, temperature ${range.temp[0]}–${range.temp[1]} °C); ${sensorsNotOnline} sensor readings not online`, {
      samplesChecked: 400,
      observedRanges: { heartRate: `${range.hr[0]}–${range.hr[1]} bpm`, spo2: `${range.spo2[0]}–${range.spo2[1]} %`, temperature: `${range.temp[0]}–${range.temp[1]} °C` },
      samplesOutOfDemoRange: outOfRange,
      sensorReadingsNotOnline: sensorsNotOnline,
      scenarioFlaggedSimulated: SCENARIOS.nominal.simulated,
    });
    expect(outOfRange).toBe(0);
    expect(sensorsNotOnline).toBe(0);
    expect(SCENARIOS.nominal.simulated).toBe(true);
    expect(SCENARIOS.nominal.disclaimer).toMatch(/SIMULATED/);
  });

  it("S1-02 UNDERSTAND: NOMINAL at every sample, no finding, reliability High", () => {
    let s = start("nominal");
    let nonNominal = 0;
    let minReliability = 100;
    for (let i = 0; i < 400; i++) {
      s = tick(s);
      if (s.analysis.level !== "NOMINAL") nonNominal++;
      minReliability = Math.min(minReliability, s.analysis.reliability.score);
    }
    const nonSystemEvents = s.events.filter((e) => e.type !== "system");
    observe("S1-02", `${nonNominal}/400 samples not NOMINAL; ${s.analysis.findings.length} findings; ${nonSystemEvents.length} non-system events; lowest reliability ${minReliability} %`, {
      samplesChecked: 400,
      samplesNotNominal: nonNominal,
      findingsAtEnd: s.analysis.findings.length,
      events: s.events.map((e) => `${e.type}: ${e.title}`),
      lowestReliabilityScore: minReliability,
      reliabilityLabel: s.analysis.reliability.label,
    });
    expect(nonNominal).toBe(0);
    expect(s.analysis.findings).toHaveLength(0);
    expect(nonSystemEvents).toHaveLength(0);
    expect(minReliability).toBeGreaterThanOrEqual(80);
  });

  it("S1-03 ACT: no medical support, routine monitoring procedure only", () => {
    const view = deriveView(advance(start("nominal"), 600));
    observe("S1-03", `${view.support.headline}; procedures: ${view.procedures.map((p) => p.id).join(", ")}`, {
      medicalSupport: `${view.support.urgency} — ${view.support.headline}`,
      procedures: view.procedures.map((p) => `${p.id} ${p.title}`),
    });
    expect(view.support.urgency).toBe("none");
    expect(view.support.required).toBe(false);
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-NM-01"]);
  });

  it("S1-04 COMMUNICATE: routine report passes through every message state with a 12-min delay", () => {
    let s = run(advance(start("nominal"), 60), { type: "SET_DELAY", minutes: 12 });
    const report = buildReportFromState(s);
    s = run(s, { type: "QUEUE_MESSAGE", kind: "incident-report", subject: report.reportId, body: reportToText(report), priority: "routine", report });
    const { state, seen } = followMessage(s, 0);
    const tl = messageTimeline(state.comms.messages[0]);
    const queued = tl.createdAt;
    const timeline = {
      sent: `+${formatDuration(tl.sentAt! - queued)}`,
      received: `+${formatDuration(tl.receivedAt! - queued)}`,
      responsePending: `+${formatDuration(tl.replySentAt! - queued)}`,
      responseReceived: `+${formatDuration(tl.replyReceivedAt! - queued)}`,
    };
    observe("S1-04", Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(" → "), {
      oneWayDelay: "12 min",
      roundTripShownInUi: "24 min",
      reportId: report.reportId,
      reportRequest: report.requestToGround,
      statesObserved: seen,
      timeline,
    });
    expect(Object.keys(seen)).toEqual(["queued", "sent", "received", "response-pending", "response-received"]);
    expect(timeline).toEqual({ sent: "+30 s", received: "+12 min 30 s", responsePending: "+14 min 30 s", responseReceived: "+26 min 30 s" });
    expect(report.requestToGround).toMatch(/routine status/);
  });
});

// ---------------------------------------------------------------------------
// Scenario 2 — Simulated vital-sign deviation
// ---------------------------------------------------------------------------

describe("Scenario 2 — Simulated vital-sign deviation", () => {
  it("S2-01 MEASURE: heart rate rises, SpO₂ falls, temperature rises; sensors stay online", () => {
    const sc = SCENARIOS["vital-deviation"];
    const before = sc.samples[sc.incidentOnsetIndex! - 1];
    const s = playToEnd("vital-deviation");
    const end = s.analysis.sensors;
    observe("S2-01", `HR ${before.hr} → ${end.hr.lastValue} bpm, SpO₂ ${before.spo2} → ${end.spo2.lastValue} %, temperature ${before.temp} → ${end.temp.lastValue} °C; sensors ${VITAL_KEYS.map((k) => end[k].status).join(" / ")}`, {
      beforeOnset: { heartRate: before.hr, spo2: before.spo2, temperature: before.temp },
      endOfRecording: { heartRate: end.hr.lastValue, spo2: end.spo2.lastValue, temperature: end.temp.lastValue },
      sensorStatusAtEnd: { heartRate: end.hr.status, spo2: end.spo2.status, temperature: end.temp.status },
      playbackComplete: isPlaybackComplete(s),
    });
    expect(end.hr.lastValue!).toBeGreaterThan(before.hr! + 30);
    expect(end.spo2.lastValue!).toBeLessThan(before.spo2! - 5);
    expect(end.temp.lastValue!).toBeGreaterThan(before.temp! + 0.5);
    for (const k of VITAL_KEYS) expect(end[k].status).toBe("online");
  });

  it("S2-02 UNDERSTAND: no detection before onset; deviations detected and escalated in order", () => {
    const s = playToEnd("vital-deviation");
    const onset = onsetTime(s, "vital-deviation");
    const timeline = s.events.filter((e) => e.type !== "system").map((e) => `${rel(s, e.t)} ${e.type} ${e.level} — ${e.title}`);
    const detected = s.events.filter((e) => e.type === "detected");
    const escalated = s.events.filter((e) => e.type === "escalated");
    observe("S2-02", `onset ${rel(s, onset)}; first detection ${formatDuration(detected[0].t - onset)} after onset; ${detected.length} detections; escalated to WARNING: ${escalated.filter((e) => e.level === "WARNING").map((e) => e.title.replace(" demo reference range", "")).join("; ")}`, {
      incidentOnset: rel(s, onset),
      eventTimeline: timeline,
      firstDetectionAfterOnset: `+${formatDuration(detected[0].t - onset)}`,
      detections: detected.length,
      escalationsToWarning: escalated.filter((e) => e.level === "WARNING").map((e) => e.title),
    });
    expect(detected[0].t).toBeGreaterThan(onset);
    expect(detected.map((e) => e.findingId).sort()).toEqual(["VITAL_OUT_OF_RANGE:hr", "VITAL_OUT_OF_RANGE:spo2", "VITAL_OUT_OF_RANGE:temp"]);
    expect(escalated.filter((e) => e.level === "WARNING").map((e) => e.findingId).sort()).toEqual(["VITAL_OUT_OF_RANGE:hr", "VITAL_OUT_OF_RANGE:spo2"]);
    const times = s.events.map((e) => e.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("S2-03 UNDERSTAND: WARNING, vital deviation, reliability High, explanations not diagnostic", () => {
    const s = playToEnd("vital-deviation");
    const text = s.analysis.findings.map((f) => `${f.title} ${f.explanation}`).join(" ").toLowerCase();
    observe("S2-03", `${s.analysis.level} · ${s.analysis.status} · reliability ${s.analysis.reliability.label} (${s.analysis.reliability.score} %) · ${DIAGNOSTIC_TERMS.filter((t) => text.includes(t)).length} diagnostic terms`, {
      attentionLevel: s.analysis.level,
      status: s.analysis.status,
      reliability: `${s.analysis.reliability.label} (${s.analysis.reliability.score} %)`,
      findings: s.analysis.findings.map((f) => `${f.level} ${f.title}`),
      diagnosticTermsFound: DIAGNOSTIC_TERMS.filter((t) => text.includes(t)),
    });
    expect(s.analysis.level).toBe("WARNING");
    expect(s.analysis.status).toBe("vital-deviation");
    expect(s.analysis.reliability.label).toBe("High");
    expect(s.analysis.findings.every((f) => f.explanation.includes("not a diagnosis"))).toBe(true);
    expect(DIAGNOSTIC_TERMS.filter((t) => text.includes(t))).toEqual([]);
  });

  it("S2-04 ACT: request medical support now; escalation and safety checklists without treatment", () => {
    const view = deriveView(playToEnd("vital-deviation"));
    const procText = PROCEDURES.flatMap((p) => p.steps.map((st) => st.text)).join(" ").toLowerCase();
    const treatmentTermsFound = TREATMENT_TERMS.filter((t) => new RegExp(`\\b${t}`).test(procText));
    observe("S2-04", `${view.support.headline}; ${view.procedures.map((p) => p.id).join(" + ")}; ${treatmentTermsFound.length} treatment terms in procedures`, {
      identifiedEvent: view.effective.findings[0]?.title,
      medicalSupport: `${view.support.urgency} — ${view.support.headline}`,
      reasons: view.support.reasons,
      procedures: view.procedures.map((p) => `${p.id} ${p.title}`),
      treatmentTermsFound,
    });
    expect(view.support.urgency).toBe("urgent");
    expect(view.support.headline).toBe("Request medical support now");
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-ESC-01", "PROC-VD-01"]);
    expect(treatmentTermsFound).toEqual([]);
  });

  it("S2-05 ACT: completed checklist steps are logged with their mission time", () => {
    let s = playToEnd("vital-deviation");
    s = run(s, { type: "TOGGLE_STEP", procedureId: "PROC-ESC-01", stepId: "esc-1", text: "Notify the Crew Medical Officer (CMO) on board now." });
    s = advance(s, 20);
    s = run(s, { type: "TOGGLE_STEP", procedureId: "PROC-VD-01", stepId: "vd-1", text: "Stop the current physical task or exercise session." });
    const logged = s.actions.filter((a) => a.kind === "procedure");
    observe("S2-05", `${logged.length} steps logged at ${logged.map((a) => rel(s, a.t)).join(" and ")}`, { actionLog: logged.map((a) => `${rel(s, a.t)} ${a.text}`) });
    expect(logged).toHaveLength(2);
    expect(logged[1].t - logged[0].t).toBeGreaterThanOrEqual(20);
    expect(Object.keys(s.completedSteps)).toEqual(["PROC-ESC-01:esc-1", "PROC-VD-01:vd-1"]);
  });

  it("S2-06 COMMUNICATE: urgent structured report with findings, actions and disclaimer", () => {
    let s = playToEnd("vital-deviation");
    s = run(s, { type: "TOGGLE_STEP", procedureId: "PROC-ESC-01", stepId: "esc-1", text: "Notify the Crew Medical Officer (CMO) on board now." });
    const r = buildReportFromState(s);
    observe("S2-06", `${r.reportId}: simulated=${r.simulated}, ${r.assessment.attentionLevel}, ${r.activeFindings.length} findings, urgency ${r.medicalSupport.urgency}, request "${r.requestToGround.split(":")[0]}", ${r.actionsTaken.length} actions`, {
      reportId: r.reportId,
      format: r.format,
      simulated: r.simulated,
      attentionLevel: r.assessment.attentionLevel,
      activeFindings: r.activeFindings.length,
      medicalSupport: r.medicalSupport.urgency,
      requestToGround: r.requestToGround,
      actionsIncluded: r.actionsTaken.length,
      disclaimer: r.disclaimer,
    });
    expect(r.simulated).toBe(true);
    expect(r.assessment.attentionLevel).toBe("WARNING");
    expect(r.activeFindings).toHaveLength(3);
    expect(r.medicalSupport.urgency).toBe("urgent");
    expect(r.requestToGround).toMatch(/^PRIORITY/);
    expect(r.actionsTaken.some((a) => a.text.includes("Crew Medical Officer"))).toBe(true);
    expect(reportToText(r)).toMatch(/SIMULATED DEMONSTRATION REPORT/);
  });

  it("S2-07 COMMUNICATE: urgent report overtakes a routine note in the queue and reaches every state", () => {
    let s = run(playToEnd("vital-deviation"), { type: "SET_DELAY", minutes: 5 }, { type: "SET_LINK", up: false });
    s = run(s, { type: "QUEUE_MESSAGE", kind: "crew-note", subject: "Crew note", body: "Routine note", priority: "routine" });
    s = advance(s, 10);
    const r = buildReportFromState(s);
    s = run(s, { type: "QUEUE_MESSAGE", kind: "incident-report", subject: r.reportId, body: reportToText(r), priority: "urgent", report: r });
    s = advance(s, 60);
    const waitingWhileDown = s.comms.messages.map((m) => messageStatus(m, s.clock).state);
    s = run(s, { type: "SET_LINK", up: true });
    // Follow the urgent report from the moment the link is restored until the simulated reply arrives.
    const { state: after, seen } = followMessage(s, 1);
    const [note, urgent] = after.comms.messages;
    observe("S2-07", `link down: ${waitingWhileDown.join(" + ")}; transmitted first: ${urgent.txStartAt! < note.txStartAt! ? "urgent report" : "routine note"}; urgent report: ${Object.entries(seen).map(([k, v]) => `${k} ${v}`).join(" → ")}`, {
      oneWayDelay: "5 min",
      statesWhileLinkDown: waitingWhileDown,
      transmissionOrder: [urgent, note].sort((a, b) => a.txStartAt! - b.txStartAt!).map((m) => `${m.id} (${m.priority})`),
      urgentReportStatesObserved: seen,
    });
    expect(waitingWhileDown).toEqual(["queued", "queued"]);
    expect(urgent.txStartAt!).toBeLessThan(note.txStartAt!);
    expect(Object.keys(seen)).toEqual(["queued", "sent", "received", "response-pending", "response-received"]);
  });
});

// ---------------------------------------------------------------------------
// Scenario 3 — Sensor fault / inconsistent reading
// ---------------------------------------------------------------------------

describe("Scenario 3 — Sensor fault / inconsistent reading", () => {
  it("S3-01 MEASURE: SpO₂ sensor degrades while heart-rate and temperature sensors stay online", () => {
    const s = playToEnd("sensor-fault");
    const sc = SCENARIOS["sensor-fault"];
    const after = sc.samples.slice(sc.incidentOnsetIndex!);
    observe("S3-01", `SpO₂ sensor ${s.analysis.sensors.spo2.status}, ${after.filter((x) => x.spo2 === null).length} dropouts, quality ≤ ${Math.round(Math.max(...after.map((x) => x.quality.spo2)) * 100)} %; heart rate ${s.analysis.sensors.hr.status}, temperature ${s.analysis.sensors.temp.status}`, {
      sensorStatusAtEnd: { heartRate: s.analysis.sensors.hr.status, spo2: s.analysis.sensors.spo2.status, temperature: s.analysis.sensors.temp.status },
      spo2SignalQualityAfterOnset: `${Math.round(Math.min(...after.map((x) => x.quality.spo2)) * 100)}–${Math.round(Math.max(...after.map((x) => x.quality.spo2)) * 100)} %`,
      spo2DropoutsAfterOnset: after.filter((x) => x.spo2 === null).length,
      heartRateRangeAfterOnset: `${Math.min(...after.map((x) => x.hr!))}–${Math.max(...after.map((x) => x.hr!))} bpm`,
    });
    expect(s.analysis.sensors.spo2.status).not.toBe("online");
    expect(s.analysis.sensors.hr.status).toBe("online");
    expect(s.analysis.sensors.temp.status).toBe("online");
    expect(after.filter((x) => x.spo2 === null).length).toBeGreaterThan(0);
  });

  it("S3-02 UNDERSTAND: sensor issue detected and not treated as a vital-sign deviation", () => {
    const s = playToEnd("sensor-fault");
    const onset = onsetTime(s, "sensor-fault");
    const detected = s.events.filter((e) => e.type === "detected");
    observe("S3-02", `first detection ${formatDuration(detected[0].t - onset)} after onset; ${s.analysis.findings.length} sensor findings, ${s.analysis.findings.filter((f) => f.category === "vital-deviation").length} vital deviations; ${s.analysis.level}; reliability ${s.analysis.reliability.label} (${s.analysis.reliability.score} %)`, {
      incidentOnset: rel(s, onset),
      firstDetectionAfterOnset: `+${formatDuration(detected[0].t - onset)}`,
      eventTimeline: s.events.filter((e) => e.type !== "system").map((e) => `${rel(s, e.t)} ${e.type} ${e.level} — ${e.title}`),
      findings: s.analysis.findings.map((f) => `${f.level} [${f.category}] ${f.title}`),
      attentionLevel: s.analysis.level,
      status: s.analysis.status,
      reliability: `${s.analysis.reliability.label} (${s.analysis.reliability.score} %)`,
    });
    expect(s.analysis.findings.map((f) => f.ruleId).sort()).toEqual(
      ["READING_INCONSISTENT", "SENSOR_ABRUPT_CHANGE", "SENSOR_DROPOUT", "SENSOR_LOW_QUALITY"].sort(),
    );
    expect(s.analysis.findings.some((f) => f.category === "vital-deviation")).toBe(false);
    expect(s.analysis.level).toBe("CAUTION");
    expect(s.analysis.status).toBe("sensor-issue");
    expect(s.analysis.reliability.label).toBe("Low");
  });

  it("S3-03 ACT: confirmation requested, sensor check, medical support not yet required", () => {
    const view = deriveView(playToEnd("sensor-fault"));
    const needs = vitalsNeedingConfirmation(view.effective.findings);
    observe("S3-03", `confirmation requested for ${needs.join(", ")}; ${view.support.headline}; ${view.procedures.map((p) => p.id).join(", ")}`, {
      confirmationRequestedFor: needs,
      medicalSupport: `${view.support.urgency} — ${view.support.headline}`,
      procedures: view.procedures.map((p) => `${p.id} ${p.title}`),
    });
    expect(needs).toEqual(["spo2"]);
    expect(view.support.urgency).toBe("monitor");
    expect(view.support.required).toBe(false);
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-SC-01"]);
  });

  it("S3-04 ACT: confirmation reading attributes the values to the sensor and closes the incident", () => {
    const s = run(playToEnd("sensor-fault"), { type: "TAKE_CONFIRMATION_READING", vital: "spo2" });
    const view = deriveView(s);
    observe("S3-04", `reading ${s.confirmations[0].reading?.spo2} % → ${s.confirmations[0].outcome}; excluded: ${view.effective.excludedVitals.join(", ")}; ${view.effective.level}; reliability ${view.effective.reliability.label} (${view.effective.reliability.score} %); ${view.support.headline}; ${view.procedures.map((p) => p.id).join(", ")}`, {
      confirmationReading: `${s.confirmations[0].reading?.spo2} % (quality ${s.confirmations[0].reading?.quality})`,
      outcome: s.confirmations[0].outcome,
      excludedVitals: view.effective.excludedVitals,
      attentionLevel: view.effective.level,
      reliability: `${view.effective.reliability.label} (${view.effective.reliability.score} %)`,
      resolvedFindings: view.effective.resolved.length,
      medicalSupport: `${view.support.urgency} — ${view.support.headline}`,
      procedures: view.procedures.map((p) => p.id),
      actionLogged: s.actions[s.actions.length - 1].text,
    });
    expect(s.confirmations[0].outcome).toBe("artifact");
    expect(view.effective.excludedVitals).toEqual(["spo2"]);
    expect(view.effective.level).toBe("ADVISORY");
    expect(view.effective.reliability.label).toBe("High");
    expect(view.support.urgency).toBe("none");
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-SR-01"]);
    expect(s.actions[s.actions.length - 1].text).toMatch(/NOT reproduced/);
  });

  it("S3-05 ACT: crew unable to re-measure leads to a medical support recommendation", () => {
    const view = deriveView(run(playToEnd("sensor-fault"), { type: "REPORT_UNABLE_TO_CONFIRM", vital: "spo2" }));
    observe("S3-05", `${view.support.headline}; procedures: ${view.procedures.map((p) => p.id).join(", ")}`, {
      medicalSupport: `${view.support.urgency} — ${view.support.headline}`,
      reasons: view.support.reasons,
      procedures: view.procedures.map((p) => p.id),
    });
    expect(view.support.urgency).toBe("recommended");
    expect(view.support.required).toBe(true);
    expect(view.procedures.map((p) => p.id)).toContain("PROC-ESC-01");
  });

  it("S3-06 COMMUNICATE: informational report includes the confirmation and resolved findings", () => {
    const s = run(playToEnd("sensor-fault"), { type: "TAKE_CONFIRMATION_READING", vital: "spo2" });
    const r = buildReportFromState(s);
    observe("S3-06", `${r.confirmations.length} confirmation and ${r.resolvedFindings.length} resolved findings in the report; urgency ${r.medicalSupport.urgency}; "${r.requestToGround}"`, {
      reportId: r.reportId,
      attentionLevel: r.assessment.attentionLevel,
      confirmations: r.confirmations.map((c) => `${c.vital}: ${c.outcome} (${c.reading})`),
      resolvedFindings: r.resolvedFindings.map((f) => f.title),
      medicalSupport: r.medicalSupport.urgency,
      requestToGround: r.requestToGround,
    });
    expect(r.confirmations).toHaveLength(1);
    expect(r.confirmations[0].outcome).toMatch(/sensor/);
    expect(r.resolvedFindings.length).toBeGreaterThan(0);
    expect(r.medicalSupport.urgency).toBe("none");
    expect(r.requestToGround).toMatch(/^For information/);
  });
});
