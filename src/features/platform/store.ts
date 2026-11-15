/**
 * Platform store of the FUTURE modules: one pure reducer that routes each action
 * to its module, then appends the returned records to the shared audit trail and
 * Earth outbox, and synchronises the outbox with the (simulated) Earth link.
 */
import journalSeed from "@/data/future/journal-demo.json";
import profileSeed from "@/data/future/profile-demo.json";
import { assessReducer, EMPTY_ASSESS, type AssessAction, type AssessState } from "@/features/assess/reducer";
import { INITIAL_EVA, type EvaState } from "@/features/eva/logic";
import { evaReducer, type EvaAction } from "@/features/eva/reducer";
import { journalReducer, type JournalAction } from "@/features/journal/reducer";
import type { JournalData } from "@/features/journal/types";
import { profileReducer, type ProfileAction, type ProfileState } from "@/features/profile/logic";
import { appendAudit } from "@/features/platform/audit";
import { createOutboxItem, syncOutbox } from "@/features/platform/earth-link";
import { addMinutes, formatMissionTime } from "@/features/platform/time";
import { clampDelayMinutes } from "@/lib/comms/delay";
import type { AuditDraft, ModuleResult, OutboxDraft, PlatformState } from "@/features/platform/types";

export interface FutureState {
  platform: PlatformState;
  journal: JournalData;
  assess: AssessState;
  profile: ProfileState;
  eva: EvaState;
}

export type PlatformAction =
  | { type: "platform/advance"; minutes: number }
  | { type: "platform/next-day" }
  | { type: "platform/set-link"; available: boolean }
  | { type: "platform/set-delay"; minutes: number }
  | { type: "platform/hydrate"; state: FutureState; notes: string[] }
  | { type: "platform/reset" };

export type FutureAction = PlatformAction | JournalAction | AssessAction | ProfileAction | EvaAction;

export const DEMO_START = { day: 15, minute: 8 * 60 };

export function seedJournal(): JournalData {
  return { schemaVersion: 1, checkIns: journalSeed.checkIns, completions: journalSeed.completions } as JournalData;
}

export function seedProfile(): ProfileState {
  return { schemaVersion: 1, entries: profileSeed.entries } as ProfileState;
}

export function createFutureState(): FutureState {
  const platform: PlatformState = {
    schemaVersion: 1,
    clock: DEMO_START,
    link: { available: true, oneWayDelayMin: 12, since: DEMO_START },
    audit: [],
    outbox: [],
    nextId: 1,
  };
  platform.audit = appendAudit(
    [],
    {
      module: "PLATFORM",
      kind: "system",
      summary: "Demonstration data loaded (14 simulated mission days, 4 simulated crew members).",
      refs: { recordId: "seed" },
    },
    DEMO_START,
  );
  return { platform, journal: seedJournal(), assess: EMPTY_ASSESS, profile: seedProfile(), eva: INITIAL_EVA };
}

/** Apply a module result: audit entries, outbox items, platform effects, then link sync. */
function commit<K extends "journal" | "assess" | "profile" | "eva">(
  state: FutureState,
  key: K,
  result: ModuleResult<FutureState[K]>,
  nextId: number,
): FutureState {
  if (result.state === state[key] && !result.audit.length && !result.outbox.length) return state;
  let platform: PlatformState = { ...state.platform, nextId };
  platform = addRecords(platform, result.audit, result.outbox);
  if (result.effects?.setLinkAvailable !== undefined && result.effects.setLinkAvailable !== platform.link.available) {
    platform = setLink(platform, result.effects.setLinkAvailable);
  }
  return { ...state, [key]: result.state, platform: sync(platform) };
}

function addRecords(platform: PlatformState, audit: AuditDraft[], outbox: OutboxDraft[]): PlatformState {
  let log = platform.audit;
  for (const a of audit) log = appendAudit(log, a, platform.clock);
  let items = platform.outbox;
  let nextId = platform.nextId;
  for (const o of outbox) {
    const id = `MSG-${String(nextId++).padStart(4, "0")}`;
    items = [...items, createOutboxItem(o, id, platform.clock)];
    log = appendAudit(log, { module: o.module, kind: "sync", summary: `Queued for Earth: “${o.title}” (${o.priority}).`, refs: { recordId: id } }, platform.clock);
  }
  return { ...platform, audit: log, outbox: items, nextId };
}

function setLink(platform: PlatformState, available: boolean): PlatformState {
  const p = { ...platform, link: { ...platform.link, available, since: platform.clock } };
  return {
    ...p,
    audit: appendAudit(
      p.audit,
      {
        module: "PLATFORM",
        kind: "sync",
        summary: available ? "Earth link restored — queued items are sent in priority order." : "Earth link LOST — modules keep working on local data; outgoing items wait in the queue.",
      },
      p.clock,
    ),
  };
}

function sync(platform: PlatformState): PlatformState {
  const { outbox, audit } = syncOutbox(platform.outbox, platform.link, platform.clock);
  if (!audit.length) return platform;
  let log = platform.audit;
  for (const a of audit) log = appendAudit(log, a, platform.clock);
  return { ...platform, outbox, audit: log };
}

/** Advance in small steps so deliveries and acknowledgements are stamped at the right time. */
function advance(platform: PlatformState, minutes: number): PlatformState {
  let p = platform;
  let left = Math.max(0, Math.round(minutes));
  while (left > 0) {
    const step = Math.min(left, 1);
    p = sync({ ...p, clock: addMinutes(p.clock, step) });
    left -= step;
  }
  return p;
}

export function futureReducer(state: FutureState, action: FutureAction): FutureState {
  let nextId = state.platform.nextId;
  const newId = (prefix: string) => `${prefix}-${String(nextId++).padStart(4, "0")}`;
  const now = state.platform.clock;

  switch (action.type) {
    case "platform/advance": {
      if (!(action.minutes > 0) || action.minutes > 3 * 1440) return state;
      return { ...state, platform: advance(state.platform, action.minutes) };
    }
    case "platform/next-day": {
      const target = { day: now.day + 1, minute: DEMO_START.minute };
      const minutes = (target.day - now.day) * 1440 + target.minute - now.minute;
      const p = advance(state.platform, minutes);
      return {
        ...state,
        platform: { ...p, audit: appendAudit(p.audit, { module: "PLATFORM", kind: "system", summary: `New mission day: ${formatMissionTime(p.clock)}.` }, p.clock) },
      };
    }
    case "platform/set-link":
      if (action.available === state.platform.link.available) return state;
      return { ...state, platform: sync(setLink(state.platform, action.available)) };
    case "platform/set-delay": {
      const minutes = clampDelayMinutes(action.minutes);
      if (minutes === state.platform.link.oneWayDelayMin) return state;
      return { ...state, platform: sync({ ...state.platform, link: { ...state.platform.link, oneWayDelayMin: minutes } }) };
    }
    case "platform/hydrate": {
      let p = action.state.platform;
      for (const note of action.notes) p = { ...p, audit: appendAudit(p.audit, { module: "PLATFORM", kind: "system", summary: note }, p.clock) };
      return { ...action.state, platform: p };
    }
    case "platform/reset":
      return createFutureState();
  }

  if (action.type.startsWith("journal/")) {
    return commit(state, "journal", journalReducer(state.journal, action as JournalAction, { now, newId }), nextId);
  }
  if (action.type.startsWith("assess/")) {
    return commit(state, "assess", assessReducer(state.assess, action as AssessAction, { now, journal: state.journal, newId }), nextId);
  }
  if (action.type.startsWith("profile/")) {
    return commit(state, "profile", profileReducer(state.profile, action as ProfileAction, { now, newId }), nextId);
  }
  if (action.type.startsWith("eva/")) {
    const ctx = { now, journal: state.journal, assess: state.assess, link: state.platform.link, newId };
    return commit(state, "eva", evaReducer(state.eva, action as EvaAction, ctx), nextId);
  }
  return state;
}
