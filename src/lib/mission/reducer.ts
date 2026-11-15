/**
 * Mission state machine.
 *
 * A single, continuous simulated mission clock drives everything:
 *  - vital-sign playback (one sample every `sampleIntervalSec` of mission time),
 *  - the analysis engine and its event history,
 *  - the Earth-link transmission queue.
 *
 * The reducer is pure so the complete MEASURE → UNDERSTAND → ACT → COMMUNICATE
 * flow can be tested without a browser.
 */
import { ANALYSIS_WINDOW, analyze } from "@/lib/analysis/engine";
import { applyConfirmations, evaluateConfirmation } from "@/lib/analysis/confirmation";
import { diffFindings, updateOpenedAt } from "@/lib/analysis/events";
import { DEFAULT_ONE_WAY_DELAY_MIN, clampDelayMinutes } from "@/lib/comms/delay";
import { advanceQueue, type LinkMessage, type MessagePriority } from "@/lib/comms/queue";
import { REFERENCE_CONFIG } from "@/config/reference-ranges";
import { assessMedicalSupport, type SupportAssessment } from "@/lib/response/escalation";
import { selectProcedures, type Procedure } from "@/lib/response/procedures";
import { buildIncidentReport, type ActionEntry, type ActionKind, type IncidentReport } from "@/lib/report/incident-report";
import { getScenario, lastTick, sampleAt } from "@/lib/scenarios";
import { formatVital } from "@/config/reference-ranges";
import type {
  AnalysisEvent,
  AnalysisResult,
  Confirmation,
  EffectiveAnalysis,
  ScenarioData,
  ScenarioId,
  VitalKey,
  VitalSample,
} from "@/lib/types";

export const TIME_SCALES = [1, 10, 30, 60] as const;
export type TimeScale = (typeof TIME_SCALES)[number];
export const DEFAULT_TIME_SCALE: TimeScale = 10;
/** Mission clock value when the app loads. */
export const INITIAL_CLOCK = 600;
/** Samples shown on the charts. */
export const CHART_WINDOW = 60;

export interface CommsState {
  oneWayDelayMin: number;
  linkUp: boolean;
  linkUpSince: number;
  messages: LinkMessage[];
}

export interface MissionState {
  clock: number;
  running: boolean;
  timeScale: TimeScale;
  scenarioId: ScenarioId;
  runId: number;
  /** Mission clock / playback tick pair used to map samples onto mission time. */
  anchorClock: number;
  anchorTick: number;
  tick: number;
  analysis: AnalysisResult;
  openedAt: Record<string, number>;
  events: AnalysisEvent[];
  actions: ActionEntry[];
  completedSteps: Record<string, number>;
  confirmations: Confirmation[];
  comms: CommsState;
  seq: number;
}

export type MissionAction =
  | { type: "TICK"; dtRealSec: number }
  | { type: "SET_RUNNING"; running: boolean }
  | { type: "SET_TIME_SCALE"; timeScale: TimeScale }
  | { type: "START_SCENARIO"; scenarioId: ScenarioId }
  | { type: "TOGGLE_STEP"; procedureId: string; stepId: string; text: string }
  | { type: "TAKE_CONFIRMATION_READING"; vital: VitalKey }
  | { type: "REPORT_UNABLE_TO_CONFIRM"; vital: VitalKey }
  | { type: "LOG_ACTION"; kind: ActionKind; text: string }
  | { type: "QUEUE_MESSAGE"; kind: LinkMessage["kind"]; subject: string; body: string; priority: MessagePriority; report?: IncidentReport }
  | { type: "SET_DELAY"; minutes: number }
  | { type: "SET_LINK"; up: boolean }
  | { type: "CLEAR_COMMS_HISTORY" };

// ---------------------------------------------------------------------------
// Time mapping helpers
// ---------------------------------------------------------------------------

export function sampleTime(state: Pick<MissionState, "anchorClock" | "anchorTick">, scenario: ScenarioData, tick: number): number {
  return state.anchorClock + (tick - state.anchorTick) * scenario.sampleIntervalSec;
}

export function tickForClock(state: Pick<MissionState, "anchorClock" | "anchorTick">, scenario: ScenarioData, clock: number): number {
  const raw = state.anchorTick + Math.floor((clock - state.anchorClock) / scenario.sampleIntervalSec + 1e-9);
  return Math.min(raw, lastTick(scenario));
}

/** Samples ending at the current tick, stamped with mission time. */
export function missionHistory(
  state: Pick<MissionState, "anchorClock" | "anchorTick" | "tick" | "scenarioId">,
  length: number,
  tick: number = state.tick,
): VitalSample[] {
  const scenario = getScenario(state.scenarioId);
  const out: VitalSample[] = [];
  for (let k = Math.max(0, tick - length + 1); k <= tick; k++) {
    out.push({ ...sampleAt(scenario, k), t: sampleTime(state, scenario, k) });
  }
  return out;
}

export function isPlaybackComplete(state: MissionState): boolean {
  const scenario = getScenario(state.scenarioId);
  return !scenario.loop && state.tick >= scenario.samples.length - 1;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

function action(state: { clock: number; seq: number }, kind: ActionKind, text: string): ActionEntry {
  return { id: `A${state.seq}`, t: state.clock, kind, text };
}

function scenarioRun(
  base: Pick<MissionState, "clock" | "seq" | "runId">,
  scenarioId: ScenarioId,
): Pick<MissionState, "scenarioId" | "runId" | "anchorClock" | "anchorTick" | "tick" | "analysis" | "openedAt" | "events" | "actions" | "completedSteps" | "confirmations" | "seq"> {
  const scenario = getScenario(scenarioId);
  const anchor = { anchorClock: base.clock, anchorTick: scenario.playbackStartIndex };
  const tick = scenario.playbackStartIndex;
  const history = missionHistory({ ...anchor, tick, scenarioId }, ANALYSIS_WINDOW);
  const analysis = analyze(history, REFERENCE_CONFIG);
  const openedAt = updateOpenedAt({}, analysis.findings, analysis.t);
  const seq = base.seq + 1;
  const startEvent: AnalysisEvent = {
    id: `${base.clock}:run${base.runId + 1}:start`,
    t: base.clock,
    type: "system",
    level: "NOMINAL",
    title: `${scenario.name} started`,
    detail: "Simulated playback started. All data shown is synthetic demonstration data.",
  };
  return {
    scenarioId,
    runId: base.runId + 1,
    ...anchor,
    tick,
    analysis,
    openedAt,
    events: [startEvent, ...diffFindings([], analysis.findings, analysis.t)],
    actions: [action({ clock: base.clock, seq }, "system", `Scenario started: ${scenario.name} (simulation)`)],
    completedSteps: {},
    confirmations: [],
    seq: seq + 1,
  };
}

export function createInitialState(scenarioId: ScenarioId = "nominal"): MissionState {
  const base = { clock: INITIAL_CLOCK, seq: 0, runId: 0 };
  return {
    clock: INITIAL_CLOCK,
    running: true,
    timeScale: DEFAULT_TIME_SCALE,
    ...scenarioRun(base, scenarioId),
    comms: {
      oneWayDelayMin: DEFAULT_ONE_WAY_DELAY_MIN,
      linkUp: true,
      linkUpSince: 0,
      messages: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function advanceClock(state: MissionState, newClock: number): MissionState {
  const scenario = getScenario(state.scenarioId);
  const targetTick = Math.max(state.tick, tickForClock(state, scenario, newClock));
  let { analysis, openedAt, events } = state;
  for (let k = state.tick + 1; k <= targetTick; k++) {
    const next = analyze(missionHistory(state, ANALYSIS_WINDOW, k), REFERENCE_CONFIG);
    const diff = diffFindings(analysis.findings, next.findings, next.t);
    if (diff.length) events = [...events, ...diff];
    openedAt = updateOpenedAt(openedAt, next.findings, next.t);
    analysis = next;
  }
  const messages = advanceQueue(state.comms.messages, newClock, {
    linkUp: state.comms.linkUp,
    linkUpSince: state.comms.linkUpSince,
    oneWayDelaySec: state.comms.oneWayDelayMin * 60,
  });
  return {
    ...state,
    clock: newClock,
    tick: targetTick,
    analysis,
    openedAt,
    events,
    comms: messages === state.comms.messages ? state.comms : { ...state.comms, messages },
  };
}

export function missionReducer(state: MissionState, act: MissionAction): MissionState {
  switch (act.type) {
    case "TICK": {
      if (!state.running || act.dtRealSec <= 0) return state;
      return advanceClock(state, state.clock + act.dtRealSec * state.timeScale);
    }
    case "SET_RUNNING":
      return { ...state, running: act.running };
    case "SET_TIME_SCALE":
      return { ...state, timeScale: act.timeScale };
    case "START_SCENARIO":
      return { ...state, ...scenarioRun(state, act.scenarioId), running: true };
    case "TOGGLE_STEP": {
      const key = `${act.procedureId}:${act.stepId}`;
      const done = key in state.completedSteps;
      const completedSteps = { ...state.completedSteps };
      if (done) delete completedSteps[key];
      else completedSteps[key] = state.clock;
      const entry = action(state, "procedure", `${done ? "Step reopened" : "Step completed"} [${act.procedureId}] ${act.text}`);
      return { ...state, completedSteps, actions: [...state.actions, entry], seq: state.seq + 1 };
    }
    case "TAKE_CONFIRMATION_READING": {
      const scenario = getScenario(state.scenarioId);
      const reading = scenario.confirmationReading;
      const outcome = evaluateConfirmation(act.vital, reading, REFERENCE_CONFIG);
      const vc = REFERENCE_CONFIG.vitals[act.vital];
      const confirmation: Confirmation = { id: `C${state.seq}`, vital: act.vital, t: state.analysis.t, outcome, reading };
      const text = `Confirmation reading ${vc.label}: ${formatVital(act.vital, reading[act.vital])} ${vc.unit} — ${
        outcome === "artifact" ? "abnormal value NOT reproduced (sensor artifact)" : "abnormal value reproduced"
      }`;
      return {
        ...state,
        confirmations: [...state.confirmations, confirmation],
        actions: [...state.actions, action(state, "confirmation", text)],
        seq: state.seq + 1,
      };
    }
    case "REPORT_UNABLE_TO_CONFIRM": {
      const vc = REFERENCE_CONFIG.vitals[act.vital];
      const confirmation: Confirmation = { id: `C${state.seq}`, vital: act.vital, t: state.analysis.t, outcome: "unable", reading: null };
      return {
        ...state,
        confirmations: [...state.confirmations, confirmation],
        actions: [...state.actions, action(state, "confirmation", `Crew unable to take a confirmation reading for ${vc.label}`)],
        seq: state.seq + 1,
      };
    }
    case "LOG_ACTION":
      return { ...state, actions: [...state.actions, action(state, act.kind, act.text)], seq: state.seq + 1 };
    case "QUEUE_MESSAGE": {
      const id = `MSG-${String(state.comms.messages.length + 1).padStart(3, "0")}`;
      const message: LinkMessage = {
        id,
        kind: act.kind,
        subject: act.subject,
        body: act.body,
        priority: act.priority,
        createdAt: state.clock,
        txStartAt: null,
        sentAt: null,
        oneWayDelaySec: null,
        report: act.report,
      };
      const messages = advanceQueue([...state.comms.messages, message], state.clock, {
        linkUp: state.comms.linkUp,
        linkUpSince: state.comms.linkUpSince,
        oneWayDelaySec: state.comms.oneWayDelayMin * 60,
      });
      return {
        ...state,
        comms: { ...state.comms, messages },
        actions: [...state.actions, action(state, "comms", `${id} queued for Earth: ${act.subject} (${act.priority})`)],
        seq: state.seq + 1,
      };
    }
    case "SET_DELAY":
      return { ...state, comms: { ...state.comms, oneWayDelayMin: clampDelayMinutes(act.minutes) } };
    case "SET_LINK": {
      if (act.up === state.comms.linkUp) return state;
      return {
        ...state,
        comms: { ...state.comms, linkUp: act.up, linkUpSince: act.up ? state.clock : state.comms.linkUpSince },
        actions: [...state.actions, action(state, "comms", act.up ? "Earth link available (simulated)" : "Earth link unavailable (simulated)")],
        seq: state.seq + 1,
      };
    }
    case "CLEAR_COMMS_HISTORY":
      return {
        ...state,
        comms: { ...state.comms, messages: state.comms.messages.filter((m) => m.sentAt === null || m.sentAt > state.clock) },
      };
  }
}

// ---------------------------------------------------------------------------
// Derived views
// ---------------------------------------------------------------------------

export interface MissionView {
  scenario: ScenarioData;
  effective: EffectiveAnalysis;
  support: SupportAssessment;
  procedures: Procedure[];
}

export function deriveView(state: MissionState): MissionView {
  const scenario = getScenario(state.scenarioId);
  const effective = applyConfirmations(state.analysis, state.confirmations, state.openedAt, REFERENCE_CONFIG);
  const support = assessMedicalSupport(effective, state.confirmations, state.openedAt);
  const procedures = selectProcedures(effective, support);
  return { scenario, effective, support, procedures };
}

export function buildReportFromState(state: MissionState, view: MissionView = deriveView(state)): IncidentReport {
  const reportCount = state.comms.messages.filter((m) => m.kind === "incident-report").length;
  return buildIncidentReport({
    reportId: `IR-${String(state.runId).padStart(2, "0")}-${String(reportCount + 1).padStart(3, "0")}`,
    generatedAtSec: state.clock,
    scenario: view.scenario,
    analysis: view.effective,
    support: view.support,
    confirmations: state.confirmations,
    actions: state.actions,
    openedAt: state.openedAt,
  });
}
