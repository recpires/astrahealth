import { describe, expect, it } from "vitest";
import { analyze, classifyValue, evaluateRange } from "@/lib/analysis/engine";
import { applyConfirmations, evaluateConfirmation } from "@/lib/analysis/confirmation";
import { diffFindings, updateOpenedAt } from "@/lib/analysis/events";
import type { VitalSample } from "@/lib/types";

const GOOD = { hr: 0.95, spo2: 0.95, temp: 0.95 };

/** Builds a history from partial samples; unspecified vitals stay nominal. */
type SamplePatch = Partial<Omit<VitalSample, "t" | "quality">> & { quality?: Partial<VitalSample["quality"]> };

function series(points: SamplePatch[], base: SamplePatch = {}): VitalSample[] {
  return points.map((p, i) => {
    const { quality: bq, ...bv } = base;
    const { quality: pq, ...pv } = p;
    return { t: i * 10, hr: 70 + (i % 3), spo2: 98, temp: 36.8, ...bv, ...pv, quality: { ...GOOD, ...bq, ...pq } };
  });
}

const nominal = (n: number) => series(Array.from({ length: n }, () => ({})));

/** Gradual change (below the abrupt-change limit) from `from` to `to` over `n` samples. */
function ramp(key: "hr" | "spo2" | "temp", from: number, to: number, n: number): SamplePatch[] {
  return Array.from({ length: n }, (_, i) => ({ [key]: Math.round((from + ((to - from) * (i + 1)) / n) * 10) / 10 }));
}

describe("classifyValue", () => {
  it("maps values to demo bands", () => {
    expect(classifyValue("spo2", 97)).toEqual({ level: "NOMINAL", side: null });
    expect(classifyValue("spo2", 93)).toEqual({ level: "CAUTION", side: "low" });
    expect(classifyValue("spo2", 88)).toEqual({ level: "WARNING", side: "low" });
    expect(classifyValue("hr", 110)).toEqual({ level: "CAUTION", side: "high" });
    expect(classifyValue("hr", 130)).toEqual({ level: "WARNING", side: "high" });
    expect(classifyValue("temp", 37.8)).toEqual({ level: "CAUTION", side: "high" });
  });
});

describe("range rule (persistence + hysteresis)", () => {
  it("ignores a single out-of-range reading", () => {
    const h = series([...Array(10).fill({}), { hr: 95 }, { hr: 104 }, { hr: 96 }, { hr: 95 }], { hr: 95 });
    expect(evaluateRange("hr", h).out).toBe(false);
    expect(analyze(h).level).toBe("NOMINAL");
  });

  it("reports a deviation after 3 consecutive readings and clears after 3 normal ones", () => {
    const up = [...Array(8).fill({}), ...ramp("hr", 72, 104, 4)];
    const out = series([...up, { hr: 106 }, { hr: 105 }]);
    const r = analyze(out);
    expect(r.findings.map((f) => f.id)).toEqual(["VITAL_OUT_OF_RANGE:hr"]);
    expect(r.level).toBe("CAUTION");
    expect(r.findings[0].explanation).toMatch(/not a diagnosis/);

    const partlyBack = series([...up, { hr: 106 }, { hr: 105 }, ...ramp("hr", 105, 95, 2)]);
    expect(evaluateRange("hr", partlyBack).out).toBe(true); // hysteresis holds
    const back = series([...up, { hr: 106 }, { hr: 105 }, ...ramp("hr", 105, 95, 2), { hr: 94 }]);
    expect(evaluateRange("hr", back).out).toBe(false);
  });

  it("needs 3 readings beyond the caution band to reach WARNING", () => {
    const h = series([...Array(10).fill({}), ...ramp("spo2", 98, 92, 2), { spo2: 89 }, { spo2: 88 }]);
    expect(analyze(h).level).toBe("CAUTION");
    const h2 = series([...Array(10).fill({}), ...ramp("spo2", 98, 92, 2), { spo2: 89 }, { spo2: 88 }, { spo2: 88 }]);
    expect(analyze(h2).level).toBe("WARNING");
  });
});

describe("sensor rules", () => {
  it("detects dropouts", () => {
    const r = analyze(series([...Array(10).fill({}), { spo2: null }]));
    expect(r.findings.some((f) => f.ruleId === "SENSOR_DROPOUT")).toBe(true);
    expect(r.sensors.spo2.status).toBe("no-signal");
  });

  it("detects physically implausible values", () => {
    const r = analyze(series([...Array(10).fill({}), { temp: 45 }]));
    const f = r.findings.find((x) => x.ruleId === "SENSOR_IMPLAUSIBLE");
    expect(f?.needsConfirmation).toBe(true);
    expect(r.sensors.temp.status).toBe("suspect");
  });

  it("detects abrupt jumps", () => {
    const r = analyze(series([...Array(10).fill({}), { spo2: 80 }]));
    expect(r.findings.some((f) => f.id === "SENSOR_ABRUPT_CHANGE:spo2")).toBe(true);
  });

  it("detects low signal quality", () => {
    const r = analyze(series([...Array(10).fill({}), ...Array(3).fill({ quality: { spo2: 0.3 } })]));
    const f = r.findings.find((x) => x.id === "SENSOR_LOW_QUALITY:spo2");
    expect(f?.level).toBe("CAUTION");
  });

  it("detects a frozen heart-rate value", () => {
    const r = analyze(series(Array.from({ length: 14 }, () => ({ hr: 72 }))));
    expect(r.findings.some((f) => f.id === "SENSOR_FLATLINE:hr")).toBe(true);
  });

  it("reclassifies an out-of-range value from a suspect sensor as inconsistent", () => {
    const r = analyze(series([...Array(10).fill({}), { spo2: 80, quality: { spo2: 0.2 } }, { spo2: 79, quality: { spo2: 0.2 } }, { spo2: 81, quality: { spo2: 0.2 } }]));
    expect(r.findings.some((f) => f.id === "READING_INCONSISTENT:spo2")).toBe(true);
    expect(r.findings.some((f) => f.category === "vital-deviation")).toBe(false);
    expect(r.status).toBe("sensor-issue");
    expect(r.reliability.label).toBe("Low");
  });

  it("rates corroborated deviations with good signal as reliable", () => {
    const both = ramp("hr", 72, 110, 3).map((p, i) => ({ ...p, spo2: [96, 94, 93][i] }));
    const r = analyze(series([...Array(10).fill({}), ...both, { hr: 111, spo2: 93 }, { hr: 112, spo2: 93 }, { hr: 112, spo2: 93 }]));
    expect(r.status).toBe("vital-deviation");
    expect(r.reliability.label).toBe("High");
    expect(r.reliability.factors.join(" ")).toMatch(/corroboration/);
  });

  it("is deterministic", () => {
    const h = series([...Array(10).fill({}), { spo2: 80 }]);
    expect(analyze(h)).toEqual(analyze(h));
  });

  it("never uses diagnostic wording", () => {
    const h = series([...Array(10).fill({}), ...Array(3).fill({ hr: 130, spo2: 85, temp: 38.5 }), { spo2: null }, { temp: 45 }]);
    const text = analyze(h).findings.map((f) => `${f.title} ${f.explanation}`).join(" ").toLowerCase();
    for (const word of ["tachycardia", "hypoxia", "hypoxemia", "fever", "infection", "diagnosed"]) {
      expect(text).not.toContain(word);
    }
  });
});

describe("events", () => {
  it("emits detected, escalated and cleared events", () => {
    const a = analyze(series([...Array(10).fill({}), { spo2: 95 }, ...Array(3).fill({ spo2: 93 })])).findings;
    const b = analyze(series([...Array(10).fill({}), { spo2: 95 }, ...Array(3).fill({ spo2: 93 }), { spo2: 89 }, { spo2: 88 }, { spo2: 88 }])).findings;
    expect(diffFindings([], a, 100).map((e) => e.type)).toEqual(["detected"]);
    expect(diffFindings(a, b, 110).map((e) => e.type)).toEqual(["escalated"]);
    expect(diffFindings(b, [], 120).map((e) => e.type)).toEqual(["cleared"]);
    expect(updateOpenedAt({ [a[0].id]: 50 }, b, 110)).toEqual({ [a[0].id]: 50 });
  });
});

describe("confirmation", () => {
  const faulty = series([...Array(10).fill({}), ...Array(3).fill({ spo2: 80, quality: { spo2: 0.2 } })]);

  it("evaluates a confirmation reading against the demo range", () => {
    expect(evaluateConfirmation("spo2", { hr: 70, spo2: 98, temp: 36.7, quality: 0.9 })).toBe("artifact");
    expect(evaluateConfirmation("spo2", { hr: 70, spo2: 88, temp: 36.7, quality: 0.9 })).toBe("confirmed");
  });

  it("turns a confirmed inconsistent reading into a vital deviation", () => {
    const raw = analyze(faulty);
    const openedAt = updateOpenedAt({}, raw.findings, raw.t);
    const eff = applyConfirmations(
      raw,
      [{ id: "C1", vital: "spo2", t: raw.t, outcome: "confirmed", reading: { hr: 70, spo2: 88, temp: 36.7, quality: 0.95 } }],
      openedAt,
    );
    const f = eff.findings.find((x) => x.id === "VITAL_CONFIRMED:spo2");
    expect(f?.category).toBe("vital-deviation");
    expect(f?.level).toBe("WARNING");
    expect(eff.findings.some((x) => x.id === "READING_INCONSISTENT:spo2")).toBe(false);
  });

  it("does not suppress findings that start after the confirmation", () => {
    const raw = analyze(faulty);
    const eff = applyConfirmations(
      raw,
      [{ id: "C1", vital: "spo2", t: 0, outcome: "artifact", reading: { hr: 70, spo2: 98, temp: 36.7, quality: 0.95 } }],
      updateOpenedAt({}, raw.findings, raw.t),
    );
    expect(eff.excludedVitals).toEqual([]);
    expect(eff.findings).toEqual(raw.findings);
  });

  it("leaves a nominal analysis untouched", () => {
    const raw = analyze(nominal(12));
    expect(applyConfirmations(raw, [], {}).findings).toEqual([]);
  });
});
