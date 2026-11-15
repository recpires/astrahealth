import { describe, expect, it } from "vitest";
import {
  MAX_ONE_WAY_DELAY_MIN,
  MIN_ONE_WAY_DELAY_MIN,
  clampDelayMinutes,
  lightTravelDistanceKm,
  roundTripMinutes,
} from "@/lib/comms/delay";
import {
  GROUND_HANDLING_SEC,
  TX_DURATION_SEC,
  advanceQueue,
  messageStatus,
  messageTimeline,
  simulatedAcknowledgement,
  type LinkMessage,
} from "@/lib/comms/queue";

const msg = (id: string, createdAt: number, priority: LinkMessage["priority"] = "routine"): LinkMessage => ({
  id,
  kind: "crew-note",
  subject: id,
  body: "",
  priority,
  createdAt,
  txStartAt: null,
  sentAt: null,
  oneWayDelaySec: null,
});

const LINK = { linkUp: true, linkUpSince: 0, oneWayDelaySec: 600 };

describe("delay", () => {
  it("clamps the one-way delay to 3–22 minutes", () => {
    expect(MIN_ONE_WAY_DELAY_MIN).toBe(3);
    expect(MAX_ONE_WAY_DELAY_MIN).toBe(22);
    expect(clampDelayMinutes(1)).toBe(3);
    expect(clampDelayMinutes(40)).toBe(22);
    expect(clampDelayMinutes(Number.NaN)).toBe(12);
  });

  it("computes round trip and light-travel distance", () => {
    expect(roundTripMinutes(12)).toBe(24);
    expect(roundTripMinutes(22)).toBe(44);
    // 3 light-minutes ≈ 53.96 million km
    expect(lightTravelDistanceKm(3) / 1e6).toBeCloseTo(53.96, 1);
  });
});

describe("transmission queue", () => {
  it("sends one message at a time in FIFO order", () => {
    const q = advanceQueue([msg("A", 0), msg("B", 0), msg("C", 0)], 45, LINK);
    expect(q.map((m) => m.txStartAt)).toEqual([0, TX_DURATION_SEC, null]);
    const q2 = advanceQueue(q, 60, LINK);
    expect(q2[2].txStartAt).toBe(60);
  });

  it("lets urgent messages jump ahead of routine ones", () => {
    const q = advanceQueue([msg("R", 0), msg("U", 1, "urgent")], 5, LINK);
    expect(q.find((m) => m.id === "U")?.txStartAt).toBe(1);
    expect(q.find((m) => m.id === "R")?.txStartAt).toBeNull();
  });

  it("holds messages while the link is unavailable", () => {
    const down = { ...LINK, linkUp: false };
    const q = advanceQueue([msg("A", 0)], 500, down);
    expect(q[0].txStartAt).toBeNull();
    const up = advanceQueue(q, 520, { ...LINK, linkUpSince: 510 });
    expect(up[0].txStartAt).toBe(510);
  });

  it("locks the delay at transmission time", () => {
    const [m] = advanceQueue([msg("A", 0)], 1, LINK);
    expect(m.oneWayDelaySec).toBe(600);
    const [same] = advanceQueue([m], 2, { ...LINK, oneWayDelaySec: 120 });
    expect(same.oneWayDelaySec).toBe(600);
  });

  it("walks through every message state", () => {
    const [m] = advanceQueue([msg("A", 0)], 0, LINK);
    const tl = messageTimeline(m);
    expect(tl.sentAt).toBe(TX_DURATION_SEC);
    expect(tl.receivedAt).toBe(TX_DURATION_SEC + 600);
    expect(tl.replySentAt).toBe(TX_DURATION_SEC + 600 + GROUND_HANDLING_SEC);
    expect(tl.replyReceivedAt).toBe(TX_DURATION_SEC + 1200 + GROUND_HANDLING_SEC);

    expect(messageStatus(msg("Q", 0), 100).state).toBe("queued");
    expect(messageStatus(m, 10)).toMatchObject({ state: "queued", transmitting: true });
    expect(messageStatus(m, 100).state).toBe("sent");
    expect(messageStatus(m, 700).state).toBe("received");
    expect(messageStatus(m, 800).state).toBe("response-pending");
    expect(messageStatus(m, 2000).state).toBe("response-received");
    expect(messageStatus(m, 330).progress).toBeCloseTo(0.5, 2);
  });

  it("labels the acknowledgement as simulated", () => {
    expect(simulatedAcknowledgement(msg("A", 0))).toMatch(/SIMULATED/);
    expect(simulatedAcknowledgement(msg("A", 0))).toMatch(/no real person/);
  });
});
