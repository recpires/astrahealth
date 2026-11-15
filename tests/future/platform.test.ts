/**
 * Platform core of the FUTURE modules: mission clock, checksum-chained audit
 * trail, store-and-forward Earth outbox and on-device storage.
 */
import { describe, expect, it } from "vitest";
import { GENESIS_HASH, appendAudit, verifyAuditChain } from "@/features/platform/audit";
import { checksum, checksumOf, stableStringify } from "@/features/platform/checksum";
import { createOutboxItem, syncOutbox, transmissionOrder } from "@/features/platform/earth-link";
import { STORAGE_PREFIX, loadFutureState, saveFutureState, type StorageLike } from "@/features/platform/storage";
import { createFutureState, futureReducer } from "@/features/platform/store";
import { addMinutes, formatMissionTime, fromAbsMinutes, toAbsMinutes } from "@/features/platform/time";
import type { AuditEntry, OutboxItem } from "@/features/platform/types";
import { memoryStorage } from "./helpers";

describe("mission clock", () => {
  it("converts between mission time and absolute minutes", () => {
    expect(toAbsMinutes({ day: 1, minute: 0 })).toBe(0);
    expect(fromAbsMinutes(toAbsMinutes({ day: 15, minute: 480 }))).toEqual({ day: 15, minute: 480 });
    expect(addMinutes({ day: 15, minute: 1430 }, 20)).toEqual({ day: 16, minute: 10 });
    expect(formatMissionTime({ day: 15, minute: 485 })).toBe("Day 15 · 08:05");
  });
});

describe("checksum", () => {
  it("is deterministic and independent of key order", () => {
    expect(checksum("abc")).toBe(checksum("abc"));
    expect(checksum("abc")).not.toBe(checksum("abd"));
    expect(checksumOf({ b: 1, a: [1, { y: 2, x: 1 }] })).toBe(checksumOf({ a: [1, { x: 1, y: 2 }], b: 1 }));
    expect(stableStringify({ b: 1, a: undefined, c: "x" })).toBe('{"b":1,"c":"x"}');
    expect(checksum("")).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe("audit trail", () => {
  const build = () => {
    let log: AuditEntry[] = [];
    for (let i = 0; i < 5; i++) log = appendAudit(log, { module: "F01", kind: "data", summary: `entry ${i}` }, { day: 15, minute: 480 + i });
    return log;
  };

  it("chains every entry to the previous one", () => {
    const log = build();
    expect(log[0].prevHash).toBe(GENESIS_HASH);
    expect(log.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    for (let i = 1; i < log.length; i++) expect(log[i].prevHash).toBe(log[i - 1].hash);
    expect(verifyAuditChain(log)).toEqual({ ok: true, checked: 5, brokenAtSeq: null, reason: null });
  });

  it("detects an edited, removed or reordered entry", () => {
    const edited = build().map((e) => ({ ...e }));
    edited[2].summary = "changed";
    expect(verifyAuditChain(edited)).toMatchObject({ ok: false, brokenAtSeq: 3 });

    const removed = build();
    removed.splice(1, 1);
    expect(verifyAuditChain(removed).ok).toBe(false);

    const swapped = build();
    [swapped[1], swapped[2]] = [swapped[2], swapped[1]];
    expect(verifyAuditChain(swapped).ok).toBe(false);
  });
});

describe("Earth outbox (store-and-forward)", () => {
  const at = { day: 15, minute: 480 };
  const items: OutboxItem[] = [
    createOutboxItem({ module: "F01", priority: "routine", title: "r1", summary: "" }, "MSG-1", at),
    createOutboxItem({ module: "F02", priority: "priority", title: "p1", summary: "" }, "MSG-2", addMinutes(at, 1)),
    createOutboxItem({ module: "F04", priority: "urgent", title: "u1", summary: "" }, "MSG-3", addMinutes(at, 2)),
    createOutboxItem({ module: "F01", priority: "routine", title: "r2", summary: "" }, "MSG-4", addMinutes(at, 3)),
  ];

  it("orders transmission by priority, then age", () => {
    expect(transmissionOrder(items).map((m) => m.id)).toEqual(["MSG-3", "MSG-2", "MSG-1", "MSG-4"]);
  });

  it("keeps everything queued while the link is lost", () => {
    const r = syncOutbox(items, { available: false, oneWayDelayMin: 12, since: at }, addMinutes(at, 60));
    expect(r.outbox.every((m) => m.state === "queued")).toBe(true);
    expect(r.audit).toHaveLength(0);
  });

  it("sends in priority order, delivers after the one-way delay and is acknowledged after the round trip", () => {
    const link = { available: true, oneWayDelayMin: 12, since: at };
    const now = addMinutes(at, 10);
    let r = syncOutbox(items, link, now);
    expect(r.outbox.find((m) => m.id === "MSG-3")!.sendOrder).toBe(1);
    expect(r.outbox.find((m) => m.id === "MSG-2")!.sendOrder).toBe(2);
    expect(r.outbox.every((m) => m.state === "sent")).toBe(true);
    r = syncOutbox(r.outbox, link, addMinutes(now, 11));
    expect(r.outbox.every((m) => m.state === "sent")).toBe(true);
    r = syncOutbox(r.outbox, link, addMinutes(now, 12));
    expect(r.outbox.every((m) => m.state === "delivered")).toBe(true);
    r = syncOutbox(r.outbox, link, addMinutes(now, 24));
    expect(r.outbox.every((m) => m.state === "acknowledged")).toBe(true);
    expect(r.outbox[0].acknowledgedAt).toEqual(addMinutes(now, 24));
  });

  it("waits for the link to return before an acknowledgement can be received", () => {
    const link = { available: true, oneWayDelayMin: 3, since: at };
    let r = syncOutbox(items.slice(0, 1), link, at);
    r = syncOutbox(r.outbox, { ...link, available: false, since: addMinutes(at, 1) }, addMinutes(at, 10));
    expect(r.outbox[0].state).toBe("delivered");
    const back = addMinutes(at, 30);
    r = syncOutbox(r.outbox, { ...link, available: true, since: back }, back);
    expect(r.outbox[0].state).toBe("acknowledged");
    expect(r.outbox[0].acknowledgedAt).toEqual(back);
  });
});

describe("platform store", () => {
  it("starts on mission day 15 with the demo seed and one audit entry", () => {
    const s = createFutureState();
    expect(s.platform.clock).toEqual({ day: 15, minute: 480 });
    expect(s.journal.checkIns.length).toBeGreaterThan(50);
    expect(s.platform.audit).toHaveLength(1);
    expect(s.platform.link.available).toBe(true);
  });

  it("advances time and moves to the next mission day at 08:00", () => {
    let s = createFutureState();
    s = futureReducer(s, { type: "platform/advance", minutes: 75 });
    expect(s.platform.clock).toEqual({ day: 15, minute: 555 });
    s = futureReducer(s, { type: "platform/next-day" });
    expect(s.platform.clock).toEqual({ day: 16, minute: 480 });
    expect(futureReducer(s, { type: "platform/advance", minutes: -5 })).toBe(s);
  });

  it("logs link changes and clamps the delay to 3–22 min", () => {
    let s = createFutureState();
    s = futureReducer(s, { type: "platform/set-link", available: false });
    expect(s.platform.link.available).toBe(false);
    expect(s.platform.audit.at(-1)!.summary).toMatch(/LOST/);
    s = futureReducer(s, { type: "platform/set-delay", minutes: 99 });
    expect(s.platform.link.oneWayDelayMin).toBe(22);
    expect(futureReducer(s, { type: "platform/set-link", available: false })).toBe(s);
  });

  it("ignores unknown or invalid actions without touching the trail", () => {
    const s = createFutureState();
    expect(futureReducer(s, { type: "journal/complete-routine", crewId: "crew-a", routineId: "nope", note: "" })).toBe(s);
  });
});

describe("on-device storage", () => {
  it("returns the seed when nothing is stored", () => {
    const r = loadFutureState(memoryStorage());
    expect(r.found).toBe(false);
    expect(r.state.platform.clock.day).toBe(15);
  });

  it("round-trips the whole state through storage", () => {
    const store = memoryStorage();
    let s = createFutureState();
    s = futureReducer(s, { type: "journal/queue-summary", crewId: "crew-b" });
    expect(saveFutureState(store, s)).toBe(true);
    expect([...store.data.keys()].every((k) => k.startsWith(STORAGE_PREFIX))).toBe(true);
    const r = loadFutureState(store);
    expect(r.found).toBe(true);
    expect(r.notes).toEqual([]);
    expect(r.state).toEqual(s);
  });

  it("only rewrites modules that changed", () => {
    const store = memoryStorage();
    const s1 = createFutureState();
    saveFutureState(store, s1);
    let writes = 0;
    const counting: StorageLike = { ...store, setItem: (k, v) => (writes++, store.setItem(k, v)) };
    const s2 = futureReducer(s1, { type: "platform/advance", minutes: 1 });
    saveFutureState(counting, s2, s1);
    expect(writes).toBe(1);
  });

  it("replaces a corrupted module with the seed and says so", () => {
    const store = memoryStorage();
    saveFutureState(store, createFutureState());
    store.setItem(`${STORAGE_PREFIX}journal`, "{not json");
    store.setItem(`${STORAGE_PREFIX}eva`, JSON.stringify({ schemaVersion: 2 }));
    const r = loadFutureState(store);
    expect(r.notes).toHaveLength(2);
    expect(r.notes[0]).toMatch(/unreadable/);
    expect(r.notes[1]).toMatch(/failed validation/);
    expect(r.state.journal.checkIns.length).toBeGreaterThan(50);
  });

  it("resets everything when the platform slice is invalid", () => {
    const store = memoryStorage();
    saveFutureState(store, createFutureState());
    store.setItem(`${STORAGE_PREFIX}platform`, JSON.stringify({ schemaVersion: 1 }));
    const r = loadFutureState(store);
    expect(r.notes.at(-1)).toMatch(/reset to demonstration data/);
  });

  it("records the restoration notes in the audit trail on hydrate", () => {
    const seed = createFutureState();
    const s = futureReducer(seed, { type: "platform/hydrate", state: seed, notes: ["note A"] });
    expect(s.platform.audit.at(-1)!.summary).toBe("note A");
    expect(verifyAuditChain(s.platform.audit).ok).toBe(true);
  });
});
