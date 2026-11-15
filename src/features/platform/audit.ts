/**
 * Shared, append-only audit trail of the FUTURE modules.
 *
 * Every decision, piece of evidence shown, action and synchronisation is
 * recorded with mission time, the rule set / protocol version used and a
 * checksum chained to the previous entry, so later edits are detectable
 * (see verifyAuditChain; FUTURE 05 runs it).
 */
import { checksumOf } from "@/features/platform/checksum";
import type { AuditDraft, AuditEntry, MissionTime } from "@/features/platform/types";

export const GENESIS_HASH = "0000000000000000";

export function entryHash(entry: Omit<AuditEntry, "hash">): string {
  return checksumOf(entry);
}

export function appendAudit(log: AuditEntry[], draft: AuditDraft, at: MissionTime): AuditEntry[] {
  const prev = log[log.length - 1];
  const base: Omit<AuditEntry, "hash"> = {
    seq: prev ? prev.seq + 1 : 1,
    at,
    module: draft.module,
    kind: draft.kind,
    summary: draft.summary,
    ...(draft.refs ? { refs: draft.refs } : {}),
    prevHash: prev ? prev.hash : GENESIS_HASH,
  };
  return [...log, { ...base, hash: entryHash(base) }];
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  /** Sequence number of the first entry that does not verify. */
  brokenAtSeq: number | null;
  reason: string | null;
}

export function verifyAuditChain(log: AuditEntry[]): ChainVerification {
  let prevHash = GENESIS_HASH;
  for (let i = 0; i < log.length; i++) {
    const { hash, ...rest } = log[i];
    if (rest.prevHash !== prevHash) {
      return { ok: false, checked: i, brokenAtSeq: rest.seq, reason: "link to the previous entry does not match" };
    }
    if (rest.seq !== (i === 0 ? rest.seq : log[i - 1].seq + 1)) {
      return { ok: false, checked: i, brokenAtSeq: rest.seq, reason: "sequence gap" };
    }
    if (entryHash(rest) !== hash) {
      return { ok: false, checked: i, brokenAtSeq: rest.seq, reason: "entry content changed after it was recorded" };
    }
    prevHash = hash;
  }
  return { ok: true, checked: log.length, brokenAtSeq: null, reason: null };
}
