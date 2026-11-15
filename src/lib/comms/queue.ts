/**
 * Simulated transmission queue for the Earth link.
 *
 * Message lifecycle (all times are simulated mission seconds):
 *
 *   QUEUED ──(transmitter free & link available)──► transmitting
 *        └─(transmission complete)──► SENT (in transit to Earth)
 *             └─(one-way delay)──► RECEIVED (by the simulated ground station)
 *                  └─(ground handling time)──► RESPONSE PENDING (reply in transit)
 *                       └─(one-way delay)──► RESPONSE RECEIVED (simulated acknowledgement)
 */
import type { IncidentReport } from "@/lib/report/incident-report";

export type MessageState = "queued" | "sent" | "received" | "response-pending" | "response-received";
export type MessagePriority = "routine" | "priority" | "urgent";

export interface LinkMessage {
  id: string;
  kind: "incident-report" | "crew-note";
  subject: string;
  body: string;
  priority: MessagePriority;
  createdAt: number;
  /** When the transmitter started sending this message. */
  txStartAt: number | null;
  /** When transmission finished and the signal left the vehicle. */
  sentAt: number | null;
  /** One-way delay locked in at transmission time (s). */
  oneWayDelaySec: number | null;
  report?: IncidentReport;
}

export interface LinkSettings {
  linkUp: boolean;
  /** Time the link (last) became available. */
  linkUpSince: number;
  oneWayDelaySec: number;
}

/** Transmitter occupancy per message (simulated). */
export const TX_DURATION_SEC = 30;
/** Simulated time the ground takes before sending an acknowledgement. */
export const GROUND_HANDLING_SEC = 120;

export const STATE_LABEL: Record<MessageState, string> = {
  queued: "Awaiting transmission",
  sent: "Sent — in transit to Earth",
  received: "Received by Earth (simulated)",
  "response-pending": "Response pending",
  "response-received": "Response received (simulated)",
};

const PRIORITY_RANK: Record<MessagePriority, number> = { urgent: 0, priority: 1, routine: 2 };

/**
 * Assigns transmission slots to queued messages up to time `now`.
 * One message is transmitted at a time; urgent messages jump ahead of routine ones.
 */
export function advanceQueue(messages: LinkMessage[], now: number, link: LinkSettings): LinkMessage[] {
  if (!link.linkUp) return messages;
  let busyUntil = messages.reduce(
    (acc, m) => (m.txStartAt !== null ? Math.max(acc, m.txStartAt + TX_DURATION_SEC) : acc),
    Number.NEGATIVE_INFINITY,
  );
  const waiting = messages
    .filter((m) => m.txStartAt === null)
    .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt);
  if (waiting.length === 0) return messages;

  const updates = new Map<string, LinkMessage>();
  for (const m of waiting) {
    const start = Math.max(m.createdAt, busyUntil, link.linkUpSince);
    if (start > now) break;
    updates.set(m.id, {
      ...m,
      txStartAt: start,
      sentAt: start + TX_DURATION_SEC,
      oneWayDelaySec: link.oneWayDelaySec,
    });
    busyUntil = start + TX_DURATION_SEC;
  }
  if (updates.size === 0) return messages;
  return messages.map((m) => updates.get(m.id) ?? m);
}

export interface MessageTimeline {
  createdAt: number;
  txStartAt: number | null;
  sentAt: number | null;
  receivedAt: number | null;
  replySentAt: number | null;
  replyReceivedAt: number | null;
}

export function messageTimeline(m: LinkMessage): MessageTimeline {
  if (m.sentAt === null || m.oneWayDelaySec === null) {
    return { createdAt: m.createdAt, txStartAt: m.txStartAt, sentAt: null, receivedAt: null, replySentAt: null, replyReceivedAt: null };
  }
  const receivedAt = m.sentAt + m.oneWayDelaySec;
  const replySentAt = receivedAt + GROUND_HANDLING_SEC;
  return {
    createdAt: m.createdAt,
    txStartAt: m.txStartAt,
    sentAt: m.sentAt,
    receivedAt,
    replySentAt,
    replyReceivedAt: replySentAt + m.oneWayDelaySec,
  };
}

export interface MessageStatus {
  state: MessageState;
  label: string;
  /** True while the transmitter is actively sending this message. */
  transmitting: boolean;
  /** Progress through the current state, 0..1 (null when open-ended). */
  progress: number | null;
  /** Time at which the current state ends (null when open-ended). */
  nextChangeAt: number | null;
}

export function messageStatus(m: LinkMessage, now: number): MessageStatus {
  const tl = messageTimeline(m);
  const span = (from: number, to: number) => Math.min(1, Math.max(0, (now - from) / Math.max(1, to - from)));
  if (tl.sentAt === null || now < tl.sentAt) {
    const transmitting = m.txStartAt !== null && now >= m.txStartAt;
    return {
      state: "queued",
      label: transmitting ? "Awaiting transmission — uplink in progress" : STATE_LABEL.queued,
      transmitting,
      progress: transmitting && tl.sentAt !== null ? span(m.txStartAt as number, tl.sentAt) : null,
      nextChangeAt: tl.sentAt,
    };
  }
  const { receivedAt, replySentAt, replyReceivedAt } = tl as Required<{ [K in keyof MessageTimeline]: number }>;
  if (now < receivedAt) {
    return { state: "sent", label: STATE_LABEL.sent, transmitting: false, progress: span(tl.sentAt, receivedAt), nextChangeAt: receivedAt };
  }
  if (now < replySentAt) {
    return { state: "received", label: STATE_LABEL.received, transmitting: false, progress: span(receivedAt, replySentAt), nextChangeAt: replySentAt };
  }
  if (now < replyReceivedAt) {
    return {
      state: "response-pending",
      label: `${STATE_LABEL["response-pending"]} — reply in transit`,
      transmitting: false,
      progress: span(replySentAt, replyReceivedAt),
      nextChangeAt: replyReceivedAt,
    };
  }
  return { state: "response-received", label: STATE_LABEL["response-received"], transmitting: false, progress: 1, nextChangeAt: null };
}

/** Text of the automatic acknowledgement generated by the simulator. */
export function simulatedAcknowledgement(m: LinkMessage): string {
  return `SIMULATED GROUND ACKNOWLEDGEMENT — Message ${m.id} ("${m.subject}") was received by the simulated ground station. This placeholder reply is generated automatically by ASTRA Health; no real person or medical team has reviewed the content.`;
}
