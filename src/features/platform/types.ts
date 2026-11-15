/**
 * ASTRA Health platform (FUTURE modules) — shared types.
 *
 * The FUTURE modules (F01–F05) run on their own mission-day clock and their own
 * state. They never write to the tested three-scenario simulation
 * (src/lib/mission); FUTURE 03 only reads its latest simulated values.
 */

/** Mission time: mission day (1 = first day) and minute of that day (0–1439). */
export interface MissionTime {
  day: number;
  minute: number;
}

export type ModuleId = "PLATFORM" | "F01" | "F02" | "F03" | "F04" | "F05";

export const MODULE_LABEL: Record<ModuleId, string> = {
  PLATFORM: "Platform",
  F01: "F01 · Health Journal",
  F02: "F02 · Symptom Assessment",
  F03: "F03 · Space Health Profile",
  F04: "F04 · EVA & Response",
  F05: "F05 · Readiness",
};

export type AuditKind = "data" | "decision" | "action" | "evidence" | "sync" | "system";

/** References that make an audit entry traceable to the rule, protocol or evidence used. */
export interface AuditRefs {
  crewId?: string;
  recordId?: string;
  /** Rule set or protocol identifier with version, e.g. "ASTRA-SYM@0.1.0-demo". */
  ruleSet?: string;
  /** Rule / step identifiers that matched. */
  ruleIds?: string[];
  evidenceIds?: string[];
  /** Checksum of the inputs a decision was computed from. */
  inputChecksum?: string;
}

export interface AuditDraft {
  module: ModuleId;
  kind: AuditKind;
  summary: string;
  refs?: AuditRefs;
}

export interface AuditEntry extends AuditDraft {
  seq: number;
  at: MissionTime;
  prevHash: string;
  hash: string;
}

export type LinkPriority = "routine" | "priority" | "urgent";

export interface OutboxDraft {
  module: ModuleId;
  priority: LinkPriority;
  title: string;
  summary: string;
  recordId?: string;
}

export type OutboxState = "queued" | "sent" | "delivered" | "acknowledged";

export interface OutboxItem extends OutboxDraft {
  id: string;
  createdAt: MissionTime;
  state: OutboxState;
  /** Order in which items left the spacecraft (1, 2, …). */
  sendOrder: number | null;
  sentAt: MissionTime | null;
  deliveredAt: MissionTime | null;
  acknowledgedAt: MissionTime | null;
}

export interface EarthLinkState {
  available: boolean;
  /** One-way signal delay (simulation, 3–22 min as in the tested Earth Link module). */
  oneWayDelayMin: number;
  /** When the link last changed between available and lost. */
  since: MissionTime;
}

export interface PlatformState {
  schemaVersion: 1;
  clock: MissionTime;
  link: EarthLinkState;
  audit: AuditEntry[];
  outbox: OutboxItem[];
  nextId: number;
}

/** What every module reducer returns: new state plus records for the shared audit trail and outbox. */
export interface ModuleResult<S> {
  state: S;
  audit: AuditDraft[];
  outbox: OutboxDraft[];
  /** Platform-level side effects requested by a module (applied by the platform store). */
  effects?: { setLinkAvailable?: boolean };
}
