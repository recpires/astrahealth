/**
 * FUTURE 03 — Extended Health Metrics / Space Health Profile.
 */
import { describe, expect, it } from "vitest";
import seed from "@/data/future/profile-demo.json";
import { DOMAINS, METRICS } from "@/features/profile/config";
import { EMPTY_PROFILE, buildProfile, profileReducer, trendOf, validateEntry, type TelemetrySnapshot } from "@/features/profile/logic";
import { referenceById } from "@/features/platform/references";
import { seedJournal, seedProfile } from "@/features/platform/store";

const TODAY = 15;
const telemetry: TelemetrySnapshot = {
  scenario: "Nominal",
  values: {
    hr: { value: 68, sensorStatus: "online", quality: 0.95 },
    spo2: { value: 98, sensorStatus: "online", quality: 0.95 },
    temp: { value: 36.8, sensorStatus: "suspect", quality: 0.3 },
  },
};
const profile = (crewId: "crew-a" | "crew-b" | "crew-c" | "crew-d" = "crew-a") =>
  buildProfile({ crewId, today: TODAY, journal: seedJournal(), profile: seedProfile(), telemetry });
const metric = (id: string, crewId?: "crew-a" | "crew-b" | "crew-c" | "crew-d") => profile(crewId).flatMap((d) => d.metrics).find((m) => m.def.id === id)!;

describe("Space Health Profile structure", () => {
  it("has exactly the nine requested domains, each with an official NASA risk reference", () => {
    expect(DOMAINS.map((d) => d.id)).toEqual(["neuro-ocular", "cardiovascular", "renal", "radiation", "bone", "vascular", "immunological", "emotional", "sleep"]);
    for (const d of DOMAINS) {
      expect(METRICS.some((m) => m.domain === d.id), d.id).toBe(true);
      for (const id of d.refIds) expect(referenceById(id), id).toBeDefined();
    }
  });

  it("gives every metric value, unit, time, origin, quality, trend and validation status", () => {
    for (const m of profile().flatMap((d) => d.metrics)) {
      for (const key of ["value", "timeText", "origin", "quality", "trend", "validation"]) expect(m, `${m.def.id}.${key}`).toHaveProperty(key);
      expect(typeof m.origin).toBe("string");
      expect(m.def.unit.length).toBeGreaterThan(0);
    }
  });
});

describe("no simulation without equipment", () => {
  const UNAVAILABLE = ["icp", "oct-imaging", "bone-density", "kidney-imaging", "urinalysis", "jugular-flow", "ecg", "blood-count", "biodosimetry", "behavioral-screen", "actigraphy"];

  it("never produces a value for intracranial pressure, bone density, kidney imaging and the other unavailable exams", () => {
    expect(METRICS.filter((m) => m.method === "unavailable").map((m) => m.id).sort()).toEqual([...UNAVAILABLE].sort());
    for (const crew of ["crew-a", "crew-b", "crew-c", "crew-d"] as const) {
      for (const id of UNAVAILABLE) {
        const m = metric(id, crew);
        expect(m).toMatchObject({ value: null, validation: "no data", lastResult: "None recorded in ASTRA Health" });
        expect(m.requiredExam).toBeTruthy();
        expect(m.def.equipment).toBeTruthy();
      }
    }
  });

  it("refuses typed values for unavailable or derived metrics", () => {
    expect(validateEntry("icp", 10)[0]).toMatch(/requires an exam or equipment that is not available/);
    expect(validateEntry("bone-density", 1)[0]).toMatch(/cannot be typed in/);
    expect(validateEntry("sleep-hours", 7)[0]).toMatch(/comes from another source/);
    const r = profileReducer(EMPTY_PROFILE, { type: "profile/add-entry", crewId: "crew-a", metricId: "icp", value: 12, quality: "good", note: "" }, { now: { day: 15, minute: 0 }, newId: () => "X" });
    expect(r.state).toBe(EMPTY_PROFILE);
  });

  it("does not ship any seed value for an unavailable metric", () => {
    const unavailable = new Set(UNAVAILABLE);
    expect(seed.entries.some((e) => unavailable.has(e.metricId))).toBe(false);
    expect(seed.simulated).toBe(true);
  });
});

describe("metric sources", () => {
  it("derives self-report metrics from the FUTURE 01 journal", () => {
    const sleep = metric("sleep-hours");
    expect(sleep).toMatchObject({ origin: "Self-report · FUTURE 01 journal", quality: "subjective", validation: "self-reported", at: { day: 14 } });
    expect(sleep.series.length).toBeGreaterThan(10);
    expect(metric("headache-days", "crew-c").value).toBe(2);
    expect(metric("illness-days", "crew-c").value).toBe(1);
  });

  it("reads simulated telemetry for Crew Member A only, flagging a suspect sensor", () => {
    expect(metric("heart-rate")).toMatchObject({ value: 68, validation: "simulated", quality: "simulated" });
    expect(metric("body-temp").quality).toBe("questionable");
    expect(metric("heart-rate", "crew-b")).toMatchObject({ value: null, validation: "no data" });
  });

  it("labels demo-seed device readings as simulated and marks them stale after their window", () => {
    expect(metric("body-mass")).toMatchObject({ validation: "demo seed (simulated)", stale: true, at: { day: 8 } });
    expect(metric("personal-dose")).toMatchObject({ value: null, validation: "no data" });
  });

  it("stores a crew-entered reading as not validated and logs it", () => {
    const r = profileReducer(seedProfile(), { type: "profile/add-entry", crewId: "crew-a", metricId: "bp-systolic", value: 119.4, quality: "questionable", note: " cuff loose " }, { now: { day: 15, minute: 600 }, newId: (p) => `${p}-1` });
    const e = r.state.entries.at(-1)!;
    expect(e).toMatchObject({ value: 119, quality: "questionable", note: "cuff loose", source: "crew-entry" });
    expect(r.audit[0]).toMatchObject({ module: "F03", kind: "data", refs: { recordId: "ME-1" } });
    const m = buildProfile({ crewId: "crew-a", today: TODAY, journal: seedJournal(), profile: r.state, telemetry }).flatMap((d) => d.metrics).find((x) => x.def.id === "bp-systolic")!;
    expect(m).toMatchObject({ value: 119, validation: "crew-entered (not validated)", stale: false });
  });

  it("checks typed values against a typing range only", () => {
    expect(validateEntry("bp-systolic", 300)[0]).toMatch(/typing check, not a clinical limit/);
    expect(validateEntry("bp-systolic", 120)).toEqual([]);
  });
});

describe("trend", () => {
  it("needs three points and uses a tolerance", () => {
    expect(trendOf([{ value: 1 }, { value: 2 }], 0)).toBe("insufficient data");
    expect(trendOf([{ value: 7 }, { value: 7.1 }, { value: 7 }, { value: 7.1 }], 0.5)).toBe("stable");
    expect(trendOf([{ value: 7 }, { value: 7 }, { value: 5 }, { value: 5 }], 0.5)).toBe("falling");
    expect(trendOf([{ value: 1 }, { value: 2 }, { value: 4 }, { value: 5 }], 0.5)).toBe("rising");
  });
});
