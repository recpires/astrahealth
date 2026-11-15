/**
 * FUTURE 04 — EVA & Autonomous Response.
 *
 * Checklists and response steps come from the versioned demonstration protocol
 * (src/data/future/eva-protocol.json). Steps that need equipment switch to their
 * alternative when that equipment is marked unavailable. The system proposes
 * (GO / HOLD, continue / end EVA); the commander decides, and overriding a
 * proposal requires a reason. Everything is logged and works without the Earth link.
 */
import protocol from "@/data/future/eva-protocol.json";
import { checksumOf } from "@/features/platform/checksum";
import { crewName } from "@/features/journal/config";
import { todaysCheckIn } from "@/features/journal/logic";
import type { CrewId, JournalData } from "@/features/journal/types";
import { evaHoldingAssessments, type AssessState } from "@/features/assess/reducer";
import type { EarthLinkState, LinkPriority, MissionTime } from "@/features/platform/types";

export type EvaPhase = "pre" | "during" | "post" | "closed";
export type AutoCheck = "checkin-today" | "no-eva-hold" | "link-noted" | "log-queued";

export interface ProtocolStep {
  id: string;
  text: string;
  requires?: string;
  alternative?: string;
  auto?: AutoCheck;
}

export interface EvaEventDef {
  id: string;
  label: string;
  priority: LinkPriority;
  proposal: "continue" | "terminate";
  sets?: Record<string, boolean>;
  link?: boolean;
  steps: ProtocolStep[];
}

export interface EvaProtocol {
  id: string;
  version: string;
  status: "PROVISIONAL";
  provenance: string;
  refIds: string[];
  equipment: { id: string; label: string }[];
  checklists: Record<"pre" | "during" | "post", ProtocolStep[]>;
  events: EvaEventDef[];
}

export const EVA_PROTOCOL = protocol as EvaProtocol;
export const EVA_PROTOCOL_REF = `${EVA_PROTOCOL.id}@${EVA_PROTOCOL.version}`;
export const EVA_PROTOCOL_CHECKSUM = checksumOf(EVA_PROTOCOL);

export interface ResolvedStep {
  id: string;
  text: string;
  usesAlternative: boolean;
  missingEquipment: string | null;
}

export function equipmentLabel(id: string): string {
  return EVA_PROTOCOL.equipment.find((e) => e.id === id)?.label ?? id;
}

export function resolveStep(step: ProtocolStep, equipment: Record<string, boolean>): ResolvedStep {
  if (step.requires && equipment[step.requires] === false) {
    return { id: step.id, text: step.alternative ?? step.text, usesAlternative: true, missingEquipment: equipmentLabel(step.requires) };
  }
  return { id: step.id, text: step.text, usesAlternative: false, missingEquipment: null };
}

export interface EvaDecision {
  choice: string;
  by: string;
  reason: string;
  override: boolean;
  at: MissionTime;
}

export interface EvaEventRecord {
  id: string;
  eventId: string;
  label: string;
  at: MissionTime;
  proposal: "continue" | "terminate";
  steps: ResolvedStep[];
  decision: EvaDecision | null;
}

export interface EvaGate {
  proposal: "go" | "hold";
  reasons: string[];
  decision: EvaDecision;
}

export interface EvaSession {
  id: string;
  crew: CrewId[];
  phase: EvaPhase;
  plannedAt: MissionTime;
  startedAt: MissionTime | null;
  endedAt: MissionTime | null;
  closedAt: MissionTime | null;
  /** Manual checklist items done: item id → time. */
  checks: Record<string, MissionTime>;
  gates: EvaGate[];
  events: EvaEventRecord[];
  logQueued: boolean;
  closeNote: string;
}

export interface EvaState {
  schemaVersion: 1;
  equipment: Record<string, boolean>;
  session: EvaSession | null;
  history: EvaSession[];
}

export const INITIAL_EVA: EvaState = {
  schemaVersion: 1,
  equipment: Object.fromEntries(EVA_PROTOCOL.equipment.map((e) => [e.id, true])),
  session: null,
  history: [],
};

export interface EvaContext {
  now: MissionTime;
  journal: JournalData;
  assess: AssessState;
  link: EarthLinkState;
}

export interface CheckStatus {
  item: ResolvedStep & { auto?: AutoCheck };
  done: boolean;
  detail: string;
}

export function autoCheck(auto: AutoCheck, session: EvaSession, ctx: EvaContext): { done: boolean; detail: string } {
  switch (auto) {
    case "checkin-today": {
      const missing = session.crew.filter((c) => !todaysCheckIn(ctx.journal, c, ctx.now.day));
      return missing.length
        ? { done: false, detail: `No check-in today: ${missing.map(crewName).join(", ")}.` }
        : { done: true, detail: "Every EVA crew member checked in today." };
    }
    case "no-eva-hold": {
      const holds = session.crew.flatMap((c) => evaHoldingAssessments(ctx.assess, c, ctx.now.day));
      return holds.length
        ? { done: false, detail: `Held by assessment ${holds.map((h) => `${h.id} (${crewName(h.crewId)})`).join(", ")}.` }
        : { done: true, detail: "No assessment holds EVA participation." };
    }
    case "link-noted":
      return { done: true, detail: ctx.link.available ? "Earth link available." : "Earth link LOST — autonomous protocol applies." };
    case "log-queued":
      return session.logQueued ? { done: true, detail: "EVA log queued." } : { done: false, detail: "EVA log not queued yet." };
  }
}

export function checklistStatus(phase: "pre" | "during" | "post", session: EvaSession, equipment: Record<string, boolean>, ctx: EvaContext): CheckStatus[] {
  return EVA_PROTOCOL.checklists[phase].map((step) => {
    const resolved = { ...resolveStep(step, equipment), auto: step.auto };
    if (step.auto) {
      const r = autoCheck(step.auto, session, ctx);
      return { item: resolved, done: r.done, detail: r.detail };
    }
    const at = session.checks[step.id];
    return { item: resolved, done: Boolean(at), detail: at ? "Confirmed by crew." : "Waiting for crew confirmation." };
  });
}

/** Deterministic GO / HOLD proposal for the pre-EVA gate. Not a medical clearance. */
export function gateProposal(session: EvaSession, equipment: Record<string, boolean>, ctx: EvaContext): { proposal: "go" | "hold"; reasons: string[] } {
  const reasons = checklistStatus("pre", session, equipment, ctx)
    .filter((c) => !c.done)
    .map((c) => `${c.item.id}: ${c.item.auto ? c.detail : "not confirmed"}`);
  return { proposal: reasons.length ? "hold" : "go", reasons };
}
