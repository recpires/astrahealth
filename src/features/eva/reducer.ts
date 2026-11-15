import {
  EVA_PROTOCOL,
  EVA_PROTOCOL_REF,
  checklistStatus,
  equipmentLabel,
  gateProposal,
  resolveStep,
  type EvaContext,
  type EvaSession,
  type EvaState,
} from "@/features/eva/logic";
import { CREW, crewName } from "@/features/journal/config";
import type { CrewId } from "@/features/journal/types";
import { formatMissionTime } from "@/features/platform/time";
import type { AuditDraft, ModuleResult, OutboxDraft } from "@/features/platform/types";

export type EvaAction =
  | { type: "eva/plan"; crew: CrewId[] }
  | { type: "eva/cancel"; by: string; reason: string }
  | { type: "eva/set-equipment"; equipmentId: string; available: boolean }
  | { type: "eva/check"; itemId: string }
  | { type: "eva/gate"; decision: "go" | "hold"; by: string; reason: string }
  | { type: "eva/event"; eventId: string }
  | { type: "eva/decide"; recordId: string; choice: "continue" | "terminate"; by: string; reason: string }
  | { type: "eva/end" }
  | { type: "eva/queue-log" }
  | { type: "eva/close"; by: string; reason: string };

export interface EvaReducerContext extends EvaContext {
  newId: (prefix: string) => string;
}

const MANUAL_ITEMS = new Set(
  (["pre", "during", "post"] as const).flatMap((p) => EVA_PROTOCOL.checklists[p].filter((s) => !s.auto).map((s) => s.id)),
);

function phaseOf(itemId: string): "pre" | "during" | "post" | null {
  for (const p of ["pre", "during", "post"] as const) if (EVA_PROTOCOL.checklists[p].some((s) => s.id === itemId)) return p;
  return null;
}

export function evaReducer(state: EvaState, action: EvaAction, ctx: EvaReducerContext): ModuleResult<EvaState> {
  const audit: AuditDraft[] = [];
  const outbox: OutboxDraft[] = [];
  const s = state.session;
  const same = { state, audit, outbox };
  const withSession = (session: EvaSession): EvaState => ({ ...state, session });
  const ref = { ruleSet: EVA_PROTOCOL_REF };

  switch (action.type) {
    case "eva/plan": {
      if (s) return same;
      const crew = [...new Set(action.crew)].filter((c) => CREW.some((m) => m.id === c));
      if (crew.length !== 2) return same;
      const session: EvaSession = {
        id: ctx.newId("EVA"),
        crew,
        phase: "pre",
        plannedAt: ctx.now,
        startedAt: null,
        endedAt: null,
        closedAt: null,
        checks: {},
        gates: [],
        events: [],
        logQueued: false,
        closeNote: "",
      };
      audit.push({ module: "F04", kind: "action", summary: `EVA ${session.id} planned for ${crew.map(crewName).join(" and ")}.`, refs: { ...ref, recordId: session.id } });
      return { ...same, state: withSession(session) };
    }

    case "eva/cancel": {
      if (!s || s.phase !== "pre" || !action.reason.trim()) return same;
      const closed = { ...s, phase: "closed" as const, closedAt: ctx.now, closeNote: `Cancelled: ${action.reason.trim()}` };
      audit.push({ module: "F04", kind: "decision", summary: `${action.by || "Commander"} cancelled EVA ${s.id} — “${action.reason.trim()}”.`, refs: { ...ref, recordId: s.id } });
      return { ...same, state: { ...state, session: null, history: [...state.history, closed] } };
    }

    case "eva/set-equipment": {
      if (!(action.equipmentId in state.equipment) || state.equipment[action.equipmentId] === action.available) return same;
      audit.push({
        module: "F04",
        kind: "data",
        summary: `${equipmentLabel(action.equipmentId)} marked ${action.available ? "available" : "UNAVAILABLE"} — dependent steps ${action.available ? "use the standard text" : "switch to their alternative"}.`,
        refs: ref,
      });
      return { ...same, state: { ...state, equipment: { ...state.equipment, [action.equipmentId]: action.available } } };
    }

    case "eva/check": {
      if (!s || !MANUAL_ITEMS.has(action.itemId)) return same;
      const phase = phaseOf(action.itemId);
      if (phase !== s.phase) return same;
      const checks = { ...s.checks };
      const undo = Boolean(checks[action.itemId]);
      if (undo) delete checks[action.itemId];
      else checks[action.itemId] = ctx.now;
      const step = resolveStep(EVA_PROTOCOL.checklists[phase].find((x) => x.id === action.itemId)!, state.equipment);
      audit.push({
        module: "F04",
        kind: "action",
        summary: `${action.itemId} ${undo ? "unchecked" : "confirmed"}${step.usesAlternative ? " (alternative step — equipment unavailable)" : ""}.`,
        refs: { ...ref, recordId: s.id, ruleIds: [action.itemId] },
      });
      return { ...same, state: withSession({ ...s, checks }) };
    }

    case "eva/gate": {
      if (!s || s.phase !== "pre") return same;
      const { proposal, reasons } = gateProposal(s, state.equipment, ctx);
      const override = action.decision !== proposal;
      const reason = action.reason.trim();
      if (override && !reason) return same;
      const decision = { choice: action.decision, by: action.by.trim() || "Commander", reason, override, at: ctx.now };
      const gates = [...s.gates, { proposal, reasons, decision }];
      audit.push({
        module: "F04",
        kind: "decision",
        summary: `Pre-EVA gate: system proposed ${proposal.toUpperCase()}${reasons.length ? ` (${reasons.length} open item${reasons.length > 1 ? "s" : ""})` : ""}; ${decision.by} decided ${action.decision.toUpperCase()}${override ? ` — OVERRIDE: “${reason}”` : ""}.`,
        refs: { ...ref, recordId: s.id, ruleIds: reasons.map((r) => r.split(":")[0]) },
      });
      if (action.decision === "go") {
        audit.push({ module: "F04", kind: "action", summary: `EVA ${s.id} started at ${formatMissionTime(ctx.now)}.`, refs: { ...ref, recordId: s.id } });
        return { ...same, state: withSession({ ...s, gates, phase: "during", startedAt: ctx.now }) };
      }
      return { ...same, state: withSession({ ...s, gates }) };
    }

    case "eva/event": {
      if (!s || s.phase !== "during") return same;
      const def = EVA_PROTOCOL.events.find((e) => e.id === action.eventId);
      if (!def) return same;
      const equipment = { ...state.equipment, ...(def.sets ?? {}) };
      const record = {
        id: ctx.newId("EVT"),
        eventId: def.id,
        label: def.label,
        at: ctx.now,
        proposal: def.proposal,
        steps: def.steps.map((st) => resolveStep(st, equipment)),
        decision: null,
      };
      audit.push({
        module: "F04",
        kind: "decision",
        summary: `EVA event “${def.label}”: protocol ${def.id} applied; system proposes ${def.proposal === "terminate" ? "ENDING the EVA" : "CONTINUING"} (commander decides).`,
        refs: { ...ref, recordId: record.id, ruleIds: [def.id, ...record.steps.filter((x) => x.usesAlternative).map((x) => `${x.id}:alternative`)] },
      });
      outbox.push({
        module: "F04",
        priority: def.priority,
        title: `EVA ${s.id} — ${def.label}`,
        summary: `${formatMissionTime(ctx.now)} · protocol ${EVA_PROTOCOL_REF}/${def.id} · proposal: ${def.proposal}`,
        recordId: record.id,
      });
      return {
        state: { ...state, equipment, session: { ...s, events: [...s.events, record] } },
        audit,
        outbox,
        effects: def.link === false ? { setLinkAvailable: false } : undefined,
      };
    }

    case "eva/decide": {
      if (!s) return same;
      const rec = s.events.find((e) => e.id === action.recordId);
      if (!rec || rec.decision) return same;
      const override = action.choice !== rec.proposal;
      const reason = action.reason.trim();
      if (override && !reason) return same;
      const decision = { choice: action.choice, by: action.by.trim() || "Commander", reason, override, at: ctx.now };
      const events = s.events.map((e) => (e.id === rec.id ? { ...e, decision } : e));
      audit.push({
        module: "F04",
        kind: "decision",
        summary: `${decision.by} decided to ${action.choice === "terminate" ? "END the EVA" : "CONTINUE"} after “${rec.label}”${override ? ` — OVERRIDE of the proposal: “${reason}”` : " (as proposed)"}.`,
        refs: { ...ref, recordId: rec.id },
      });
      const ending = action.choice === "terminate" && s.phase === "during";
      if (ending) audit.push({ module: "F04", kind: "action", summary: `EVA ${s.id} ended early at ${formatMissionTime(ctx.now)}.`, refs: { ...ref, recordId: s.id } });
      return { ...same, state: withSession({ ...s, events, ...(ending ? { phase: "post" as const, endedAt: ctx.now } : {}) }) };
    }

    case "eva/end": {
      if (!s || s.phase !== "during") return same;
      audit.push({ module: "F04", kind: "action", summary: `EVA ${s.id} ended at ${formatMissionTime(ctx.now)}.`, refs: { ...ref, recordId: s.id } });
      return { ...same, state: withSession({ ...s, phase: "post", endedAt: ctx.now }) };
    }

    case "eva/queue-log": {
      if (!s || s.phase !== "post" || s.logQueued) return same;
      const decisions = s.gates.length + s.events.filter((e) => e.decision).length;
      outbox.push({
        module: "F04",
        priority: "routine",
        title: `EVA ${s.id} log`,
        summary: `${s.crew.map(crewName).join(" & ")} · start ${s.startedAt ? formatMissionTime(s.startedAt) : "—"} · end ${s.endedAt ? formatMissionTime(s.endedAt) : "—"} · ${s.events.length} event(s) · ${decisions} decision(s) · protocol ${EVA_PROTOCOL_REF}`,
        recordId: s.id,
      });
      audit.push({ module: "F04", kind: "action", summary: `EVA ${s.id} log queued for Earth (routine).`, refs: { ...ref, recordId: s.id } });
      return { ...same, outbox, state: withSession({ ...s, logQueued: true }) };
    }

    case "eva/close": {
      if (!s || s.phase !== "post") return same;
      const open = checklistStatus("post", s, state.equipment, ctx).filter((c) => !c.done);
      const reason = action.reason.trim();
      if (open.length && !reason) return same;
      const closed = { ...s, phase: "closed" as const, closedAt: ctx.now, closeNote: reason };
      audit.push({
        module: "F04",
        kind: "decision",
        summary: `${action.by || "Commander"} closed EVA ${s.id}${open.length ? ` with ${open.length} open post-EVA item(s) — “${reason}”` : " — all post-EVA items done"}.`,
        refs: { ...ref, recordId: s.id, ruleIds: open.map((o) => o.item.id) },
      });
      return { ...same, state: { ...state, session: null, history: [...state.history, closed] } };
    }
  }
}
