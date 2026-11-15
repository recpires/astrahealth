/**
 * End-to-end flow tests: each demo scenario goes through
 * MEASURE → UNDERSTAND → ACT → COMMUNICATE using the pure mission reducer.
 */
import { describe, expect, it } from "vitest";
import {
  buildReportFromState,
  createInitialState,
  deriveView,
  isPlaybackComplete,
  missionReducer,
  type MissionAction,
  type MissionState,
} from "@/lib/mission/reducer";
import { messageStatus } from "@/lib/comms/queue";
import { reportToText } from "@/lib/report/incident-report";
import { SCENARIOS } from "@/lib/scenarios";

function run(state: MissionState, ...actions: MissionAction[]): MissionState {
  return actions.reduce(missionReducer, state);
}

/** Advances the mission clock by `missionSeconds` in 1-second real ticks. */
function advance(state: MissionState, missionSeconds: number): MissionState {
  let s = state;
  const steps = Math.ceil(missionSeconds / s.timeScale);
  for (let i = 0; i < steps; i++) s = missionReducer(s, { type: "TICK", dtRealSec: 1 });
  return s;
}

function playToEnd(scenarioId: MissionState["scenarioId"]): MissionState {
  let s = run(createInitialState(), { type: "START_SCENARIO", scenarioId });
  const n = SCENARIOS[scenarioId].samples.length;
  s = advance(s, n * SCENARIOS[scenarioId].sampleIntervalSec);
  return s;
}

describe("simulated data", () => {
  it("every scenario is flagged as simulated demonstration data", () => {
    for (const s of Object.values(SCENARIOS)) {
      expect(s.simulated).toBe(true);
      expect(s.disclaimer).toMatch(/SIMULATED/);
      expect(s.crewMember).toMatch(/simulated/i);
      expect(s.samples.length).toBe(180);
    }
  });
});

describe("Scenario 1 — nominal monitoring", () => {
  it("stays NOMINAL for the whole recording, including the loop seam", () => {
    let s = createInitialState("nominal");
    for (let i = 0; i < 400; i++) {
      s = missionReducer(s, { type: "TICK", dtRealSec: 1 });
      expect(s.analysis.level).toBe("NOMINAL");
    }
    expect(s.events.filter((e) => e.type !== "system")).toHaveLength(0);
  });

  it("requires no medical support and offers only routine monitoring", () => {
    const s = advance(createInitialState("nominal"), 600);
    const view = deriveView(s);
    expect(view.support.urgency).toBe("none");
    expect(view.support.required).toBe(false);
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-NM-01"]);
    expect(view.effective.reliability.label).toBe("High");
  });

  it("can still send a routine status report to Earth", () => {
    let s = advance(createInitialState("nominal"), 60);
    const report = buildReportFromState(s);
    expect(report.requestToGround).toMatch(/routine status/i);
    s = run(s, { type: "QUEUE_MESSAGE", kind: "incident-report", subject: "Status", body: reportToText(report), priority: "routine", report });
    expect(s.comms.messages).toHaveLength(1);
  });
});

describe("Scenario 2 — simulated vital-sign deviation", () => {
  it("detects the deviation and escalates to WARNING with reliable data", () => {
    const s = playToEnd("vital-deviation");
    expect(isPlaybackComplete(s)).toBe(true);
    expect(s.analysis.level).toBe("WARNING");
    expect(s.analysis.status).toBe("vital-deviation");
    const ids = s.analysis.findings.map((f) => f.id);
    expect(ids).toEqual(expect.arrayContaining(["VITAL_OUT_OF_RANGE:hr", "VITAL_OUT_OF_RANGE:spo2", "VITAL_OUT_OF_RANGE:temp"]));
    expect(s.analysis.findings.every((f) => f.category === "vital-deviation")).toBe(true);
    expect(s.analysis.reliability.label).toBe("High");
  });

  it("records detection and escalation events in order", () => {
    const s = playToEnd("vital-deviation");
    const detected = s.events.filter((e) => e.type === "detected");
    const escalated = s.events.filter((e) => e.type === "escalated");
    expect(detected.length).toBe(3);
    expect(escalated.length).toBeGreaterThanOrEqual(1);
    const times = s.events.map((e) => e.t);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
    // No detection before the scripted onset.
    const scenario = SCENARIOS["vital-deviation"];
    const onsetTime = s.anchorClock + (scenario.incidentOnsetIndex! - s.anchorTick) * scenario.sampleIntervalSec;
    expect(detected[0].t).toBeGreaterThan(onsetTime);
  });

  it("asks for medical support now and presents the right procedures", () => {
    const view = deriveView(playToEnd("vital-deviation"));
    expect(view.support.urgency).toBe("urgent");
    expect(view.support.required).toBe(true);
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-ESC-01", "PROC-VD-01"]);
  });

  it("logs crew actions and sends an urgent report through the delayed link", () => {
    let s = playToEnd("vital-deviation");
    s = run(
      s,
      { type: "TOGGLE_STEP", procedureId: "PROC-VD-01", stepId: "vd-1", text: "Stop the current physical task" },
      { type: "TOGGLE_STEP", procedureId: "PROC-ESC-01", stepId: "esc-1", text: "Notify the CMO" },
      { type: "SET_DELAY", minutes: 5 },
    );
    expect(Object.keys(s.completedSteps)).toHaveLength(2);
    const report = buildReportFromState(s);
    expect(report.simulated).toBe(true);
    expect(report.assessment.attentionLevel).toBe("WARNING");
    expect(report.medicalSupport.urgency).toBe("urgent");
    expect(report.actionsTaken.some((a) => a.text.includes("Notify the CMO"))).toBe(true);
    expect(report.requestToGround).toMatch(/PRIORITY/);
    expect(reportToText(report)).toMatch(/SIMULATED DEMONSTRATION REPORT/);

    s = run(s, { type: "QUEUE_MESSAGE", kind: "incident-report", subject: report.reportId, body: reportToText(report), priority: "urgent", report });
    const msg = () => s.comms.messages[0];
    expect(messageStatus(msg(), s.clock).state).toBe("queued");
    s = advance(s, 40); // transmission (30 s)
    expect(messageStatus(msg(), s.clock).state).toBe("sent");
    expect(msg().oneWayDelaySec).toBe(300);
    s = advance(s, 300);
    expect(messageStatus(msg(), s.clock).state).toBe("received");
    s = advance(s, 130);
    expect(messageStatus(msg(), s.clock).state).toBe("response-pending");
    s = advance(s, 300);
    expect(messageStatus(msg(), s.clock).state).toBe("response-received");
  });
});

describe("Scenario 3 — sensor fault / inconsistent reading", () => {
  it("flags a sensor issue instead of a vital deviation", () => {
    const s = playToEnd("sensor-fault");
    expect(s.analysis.status).toBe("sensor-issue");
    expect(s.analysis.level).toBe("CAUTION");
    expect(s.analysis.findings.some((f) => f.id === "READING_INCONSISTENT:spo2" && f.needsConfirmation)).toBe(true);
    expect(s.analysis.findings.some((f) => f.category === "vital-deviation")).toBe(false);
    expect(s.analysis.sensors.spo2.status).not.toBe("online");
    expect(s.analysis.sensors.hr.status).toBe("online");
    expect(s.analysis.reliability.label).toBe("Low");
  });

  it("asks for a sensor check, not medical support, before confirmation", () => {
    const view = deriveView(playToEnd("sensor-fault"));
    expect(view.support.urgency).toBe("monitor");
    expect(view.support.required).toBe(false);
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-SC-01"]);
  });

  it("confirmation reading attributes the values to the sensor and closes the incident", () => {
    let s = playToEnd("sensor-fault");
    s = run(s, { type: "TAKE_CONFIRMATION_READING", vital: "spo2" });
    const view = deriveView(s);
    expect(s.confirmations[0].outcome).toBe("artifact");
    expect(view.effective.excludedVitals).toEqual(["spo2"]);
    expect(view.effective.level).toBe("ADVISORY");
    expect(view.effective.findings.map((f) => f.id)).toEqual(["SENSOR_EXCLUDED:spo2"]);
    expect(view.effective.resolved.length).toBeGreaterThan(0);
    expect(view.effective.reliability.label).toBe("High");
    expect(view.support.urgency).toBe("none");
    expect(view.procedures.map((p) => p.id)).toEqual(["PROC-SR-01"]);
    const report = buildReportFromState(s, view);
    expect(report.resolvedFindings.length).toBeGreaterThan(0);
    expect(report.requestToGround).toMatch(/For information/);
  });

  it("escalates to medical support when the crew cannot confirm", () => {
    let s = playToEnd("sensor-fault");
    s = run(s, { type: "REPORT_UNABLE_TO_CONFIRM", vital: "spo2" });
    const view = deriveView(s);
    expect(view.support.urgency).toBe("recommended");
    expect(view.support.required).toBe(true);
    expect(view.procedures.map((p) => p.id)).toContain("PROC-ESC-01");
  });
});
