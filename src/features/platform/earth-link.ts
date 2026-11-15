/**
 * Store-and-forward outbox to Earth for the FUTURE modules.
 *
 * SIMULATION. Works fully offline: items are always created locally and wait
 * while the link is lost. When the link is available they leave the spacecraft
 * in priority order (urgent → priority → routine, then oldest first), arrive on
 * Earth after the one-way delay and are acknowledged after a full round trip.
 * The 3–22 min delay range is the same one used by the tested Earth Link module.
 */
import { clampDelayMinutes } from "@/lib/comms/delay";
import { addMinutes, compareTime, toAbsMinutes } from "@/features/platform/time";
import type {
  AuditDraft,
  EarthLinkState,
  LinkPriority,
  MissionTime,
  OutboxDraft,
  OutboxItem,
} from "@/features/platform/types";

export const PRIORITY_RANK: Record<LinkPriority, number> = { urgent: 0, priority: 1, routine: 2 };

export function createOutboxItem(draft: OutboxDraft, id: string, at: MissionTime): OutboxItem {
  return {
    ...draft,
    id,
    createdAt: at,
    state: "queued",
    sendOrder: null,
    sentAt: null,
    deliveredAt: null,
    acknowledgedAt: null,
  };
}

/** Queued items in the order they will be transmitted. */
export function transmissionOrder(outbox: OutboxItem[]): OutboxItem[] {
  return outbox
    .filter((m) => m.state === "queued")
    .slice()
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || compareTime(a.createdAt, b.createdAt) || a.id.localeCompare(b.id));
}

/**
 * Advance every outbox item to the state it has at `now`.
 * Pure: returns the new outbox and audit drafts describing each transition.
 */
export function syncOutbox(outbox: OutboxItem[], link: EarthLinkState, now: MissionTime): { outbox: OutboxItem[]; audit: AuditDraft[] } {
  const audit: AuditDraft[] = [];
  const delay = clampDelayMinutes(link.oneWayDelayMin);
  let lastOrder = outbox.reduce((m, i) => Math.max(m, i.sendOrder ?? 0), 0);
  const ordered = link.available ? transmissionOrder(outbox) : [];
  const sendNow = new Set(ordered.map((m) => m.id));

  const next = outbox.map((item) => ({ ...item }));
  const byId = new Map(next.map((i) => [i.id, i]));

  for (const q of ordered) {
    const item = byId.get(q.id)!;
    item.state = "sent";
    item.sendOrder = ++lastOrder;
    item.sentAt = now;
    audit.push({
      module: "PLATFORM",
      kind: "sync",
      summary: `Transmitted "${item.title}" (${item.priority}, #${item.sendOrder} in send order).`,
      refs: { recordId: item.id },
    });
  }

  const inFlight = next.filter((i) => i.sendOrder !== null).sort((a, b) => (a.sendOrder ?? 0) - (b.sendOrder ?? 0));
  for (const item of inFlight) {
    if (sendNow.has(item.id)) continue;
    // Once transmitted, the signal is in flight and reaches Earth even if the link is lost meanwhile.
    if (item.state === "sent" && item.sentAt && toAbsMinutes(now) >= toAbsMinutes(item.sentAt) + delay) {
      item.state = "delivered";
      item.deliveredAt = addMinutes(item.sentAt, delay);
      audit.push({ module: "PLATFORM", kind: "sync", summary: `"${item.title}" reached Earth (simulated).`, refs: { recordId: item.id } });
    }
    // The acknowledgement can only be received while the link is available.
    if (link.available && item.state === "delivered" && item.sentAt && toAbsMinutes(now) >= toAbsMinutes(item.sentAt) + 2 * delay) {
      item.state = "acknowledged";
      const due = toAbsMinutes(item.sentAt) + 2 * delay;
      item.acknowledgedAt = due >= toAbsMinutes(link.since) ? addMinutes(item.sentAt, 2 * delay) : link.since;
      audit.push({ module: "PLATFORM", kind: "sync", summary: `Ground acknowledgement received for "${item.title}" (simulated).`, refs: { recordId: item.id } });
    }
  }
  return { outbox: next, audit };
}

export function pendingCount(outbox: OutboxItem[]): number {
  return outbox.filter((m) => m.state !== "acknowledged").length;
}
