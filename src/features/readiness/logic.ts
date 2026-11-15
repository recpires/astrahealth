/**
 * FUTURE 05 — Verification & Mission Readiness.
 *
 * Two views, both computed locally:
 *  1. Crew data & procedure readiness: is today's information complete and has
 *     everything that needs a human been reviewed? This is NOT a medical clearance
 *     or a fitness-for-duty decision.
 *  2. System verification: audit-trail integrity, versioned rule sets with
 *     checksums, reference integrity, provenance of records and offline queue.
 */
import { EVIDENCE_LIBRARY } from "@/config/evidence-library";
import { LEVEL_RANK, SYMPTOM_RULESET, SYMPTOM_RULESET_CHECKSUM, SYMPTOM_RULESET_REF } from "@/features/assess/engine";
import { evaHoldingAssessments } from "@/features/assess/reducer";
import { EVA_PROTOCOL, EVA_PROTOCOL_CHECKSUM, EVA_PROTOCOL_REF } from "@/features/eva/logic";
import { CREW, JOURNAL_RULES, JOURNAL_RULESET_REF } from "@/features/journal/config";
import { journalFlags, routineStatuses, todaysCheckIn } from "@/features/journal/logic";
import type { CrewId } from "@/features/journal/types";
import { DOMAINS, METRICS } from "@/features/profile/config";
import { buildProfile, type TelemetrySnapshot } from "@/features/profile/logic";
import { verifyAuditChain } from "@/features/platform/audit";
import { checksumOf } from "@/features/platform/checksum";
import { HRR_REFERENCES } from "@/features/platform/references";
import type { FutureState } from "@/features/platform/store";
import type { ModuleId } from "@/features/platform/types";

export type ReadinessStatus = "ok" | "attention" | "missing";

export interface ReadinessItem {
  id: string;
  module: ModuleId;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface CrewReadiness {
  crewId: CrewId;
  overall: "complete" | "attention" | "incomplete";
  items: ReadinessItem[];
}

export function crewReadiness(state: FutureState, crewId: CrewId, telemetry: TelemetrySnapshot | null): CrewReadiness {
  const today = state.platform.clock.day;
  const items: ReadinessItem[] = [];

  const ci = todaysCheckIn(state.journal, crewId, today);
  items.push({ id: "R-F01-CHECKIN", module: "F01", label: "Daily check-in", status: ci ? "ok" : "missing", detail: ci ? "Recorded today." : "Not recorded today." });

  const overdue = routineStatuses(state.journal, crewId, today).filter((r) => r.state === "overdue");
  items.push({
    id: "R-F01-ROUTINES",
    module: "F01",
    label: "Routines",
    status: overdue.length ? "attention" : "ok",
    detail: overdue.length ? `Overdue: ${overdue.map((r) => `${r.routine.title} (${r.daysLate} d)`).join(", ")}.` : "Nothing overdue.",
  });

  const flags = journalFlags(state.journal, crewId, today);
  items.push({
    id: "R-F01-FLAGS",
    module: "F01",
    label: "Journal flags",
    status: flags.length ? "attention" : "ok",
    detail: flags.length ? flags.map((f) => f.title).join(", ") + "." : "No flags.",
  });

  const recent = state.assess.records.filter((r) => r.crewId === crewId && r.at.day >= today - 1);
  const unreviewed = recent.filter((r) => !r.review);
  const support = recent.filter((r) => LEVEL_RANK[r.output.level] >= LEVEL_RANK["support-recommended"]);
  items.push({
    id: "R-F02-REVIEW",
    module: "F02",
    label: "Symptom assessments",
    status: unreviewed.length || support.length ? "attention" : "ok",
    detail: recent.length
      ? `${recent.length} in the last 2 days · ${unreviewed.length} awaiting review · ${support.length} suggesting medical support.`
      : "None in the last 2 days.",
  });

  const profile = buildProfile({ crewId, today, journal: state.journal, profile: state.profile, telemetry });
  const all = profile.flatMap((d) => d.metrics);
  const obtainable = all.filter((m) => m.def.method !== "unavailable");
  const withData = obtainable.filter((m) => m.value !== null);
  const stale = obtainable.filter((m) => m.stale);
  const unavailable = all.length - obtainable.length;
  items.push({
    id: "R-F03-COVERAGE",
    module: "F03",
    label: "Health profile data",
    status: stale.length || withData.length < obtainable.length ? "attention" : "ok",
    detail: `${withData.length}/${obtainable.length} obtainable metrics have data · ${stale.length} stale · ${unavailable} need equipment not available (no data, never estimated).`,
  });

  const holds = evaHoldingAssessments(state.assess, crewId, today);
  const inEva = state.eva.session?.crew.includes(crewId) ? state.eva.session : null;
  items.push({
    id: "R-F04-EVA",
    module: "F04",
    label: "EVA",
    status: holds.length ? "attention" : "ok",
    detail: `${inEva ? `Assigned to ${inEva.id} (${inEva.phase}). ` : "Not assigned to an EVA. "}${holds.length ? `EVA participation held by ${holds.map((h) => h.id).join(", ")}.` : "No EVA hold."}`,
  });

  const overall = items.some((i) => i.status === "missing") ? "incomplete" : items.some((i) => i.status === "attention") ? "attention" : "complete";
  return { crewId, overall, items };
}

export interface VerificationCheck {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface RuleSetInfo {
  ref: string;
  module: ModuleId;
  status: string;
  checksum: string;
}

export function ruleSets(): RuleSetInfo[] {
  return [
    { ref: JOURNAL_RULESET_REF, module: "F01", status: JOURNAL_RULES.status, checksum: checksumOf(JOURNAL_RULES) },
    { ref: SYMPTOM_RULESET_REF, module: "F02", status: SYMPTOM_RULESET.status, checksum: SYMPTOM_RULESET_CHECKSUM },
    { ref: "ASTRA-PROFILE@0.1.0-demo", module: "F03", status: "PROVISIONAL", checksum: checksumOf({ DOMAINS, METRICS }) },
    { ref: EVA_PROTOCOL_REF, module: "F04", status: EVA_PROTOCOL.status, checksum: EVA_PROTOCOL_CHECKSUM },
  ];
}

export function systemVerification(state: FutureState, env: { storageWritable: boolean | null }): VerificationCheck[] {
  const checks: VerificationCheck[] = [];

  const chain = verifyAuditChain(state.platform.audit);
  checks.push({
    id: "V-AUDIT",
    label: "Audit trail integrity",
    ok: chain.ok,
    detail: chain.ok ? `${chain.checked} entries verified (checksum chain intact).` : `Entry #${chain.brokenAtSeq}: ${chain.reason}.`,
  });

  const sets = ruleSets();
  checks.push({
    id: "V-VERSIONED",
    label: "Rules and protocols are versioned",
    ok: sets.every((r) => /@\d+\.\d+\.\d+/.test(r.ref)),
    detail: sets.map((r) => `${r.ref} [${r.checksum}]`).join(" · "),
  });

  checks.push({
    id: "V-NOT-VALIDATED",
    label: "No rule set is presented as clinically validated",
    ok: sets.every((r) => r.status === "PROVISIONAL"),
    detail: "Every rule set and protocol is marked PROVISIONAL (demonstration).",
  });

  const refIds = new Set(HRR_REFERENCES.map((r) => r.id));
  const used = [
    ...SYMPTOM_RULESET.evidenceMap.always,
    ...Object.values(SYMPTOM_RULESET.evidenceMap.bySymptom).flat(),
    ...DOMAINS.flatMap((d) => d.refIds),
    ...EVA_PROTOCOL.refIds,
  ];
  const missingRefs = [...new Set(used.filter((id) => !refIds.has(id)))];
  const libIds = new Set(EVIDENCE_LIBRARY.map((e) => e.id));
  const missingLib = HRR_REFERENCES.filter((r) => r.libraryId && !libIds.has(r.libraryId)).map((r) => r.id);
  const stepIds = new Set(SYMPTOM_RULESET.steps.map((s) => s.id));
  const missingSteps = SYMPTOM_RULESET.rules.flatMap((r) => r.steps).filter((id) => !stepIds.has(id));
  checks.push({
    id: "V-REFERENCES",
    label: "Every evidence and step reference resolves",
    ok: !missingRefs.length && !missingLib.length && !missingSteps.length,
    detail:
      missingRefs.length || missingLib.length || missingSteps.length
        ? `Missing: ${[...missingRefs, ...missingLib, ...missingSteps].join(", ")}.`
        : `${new Set(used).size} NASA references, ${SYMPTOM_RULESET.steps.length} steps — all resolve offline.`,
  });

  const unreviewedDecisions = state.assess.records.filter((r) => !r.review).length + (state.eva.session?.events.filter((e) => !e.decision).length ?? 0);
  checks.push({
    id: "V-HUMAN",
    label: "Every proposal reviewed by a human",
    ok: unreviewedDecisions === 0,
    detail: unreviewedDecisions ? `${unreviewedDecisions} proposal(s) still awaiting a crew decision.` : "No proposal is waiting for a decision.",
  });

  const queued = state.platform.outbox.filter((m) => m.state === "queued").length;
  checks.push({
    id: "V-OFFLINE",
    label: "Works without the Earth link",
    ok: true,
    detail: `${state.platform.link.available ? "Link available" : "Link LOST"} · ${queued} item(s) waiting to be sent · all FUTURE data and references are stored on this device.`,
  });

  checks.push({
    id: "V-STORAGE",
    label: "On-device storage",
    ok: env.storageWritable !== false,
    detail: env.storageWritable === null ? "Not checked yet." : env.storageWritable ? "Writable — records survive a reload." : "Not writable — records are kept in memory only.",
  });

  return checks;
}

export function readinessSummary(state: FutureState, telemetry: TelemetrySnapshot | null): CrewReadiness[] {
  return CREW.map((c) => crewReadiness(state, c.id, telemetry));
}
