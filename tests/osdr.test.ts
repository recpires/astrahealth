/**
 * NASA OSDR import: verbatim snapshot, correct summaries, and strict separation
 * from the simulated vital signs.
 */
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OsdrFormatError, parseCsv, parseTimepoint, summarizeOsdrMultiplex } from "@/lib/science/osdr";
import { OSDR_SNAPSHOTS } from "@/lib/science/osdr-datasets";
import { SCENARIOS } from "@/lib/scenarios";

const ROOT = join(__dirname, "..");
const fixture = readFileSync(join(__dirname, "fixtures", "osdr-multiplex-sample.csv"), "utf8");

describe("CSV parsing", () => {
  it("handles BOM, quotes, escaped quotes and CRLF", () => {
    expect(parseCsv('﻿a,"b,c","d ""e"""\r\n1,2,3\r\n')).toEqual([
      ["a", "b,c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("orders timepoints launch-relative then return-relative", () => {
    expect(parseTimepoint("L-92")).toEqual({ phase: "pre-flight", day: -92 });
    expect(parseTimepoint("R+194")).toEqual({ phase: "post-flight", day: 194 });
    expect(parseTimepoint("X1")).toBeNull();
  });
});

describe("OSDR multiplex summary", () => {
  it("computes n, mean, min and max per timepoint without exposing per-person values", () => {
    const s = summarizeOsdrMultiplex(fixture);
    expect(s.subjects).toBe(2);
    expect(s.samples).toBe(5);
    expect(s.timepoints).toEqual(["L-44", "L-3", "R+1"]);
    const crp = s.analytes.find((a) => a.key === "crp")!;
    expect(crp.unit).toBe("pg/mL");
    expect(crp.points.find((p) => p.timepoint === "L-3")).toMatchObject({ n: 2, mean: 200, min: 100, max: 300 });
    const pf4 = s.analytes.find((a) => a.key === "pf4")!;
    expect(pf4.unit).toBe("ng/mL");
    expect(pf4.points.find((p) => p.timepoint === "R+1")).toMatchObject({ n: 1, mean: 6 }); // blank cell skipped
    expect(s.ignoredColumns.map((c) => c.column)).toEqual(["crp_percent", "pf4_percent"]);
    expect(JSON.stringify(s)).not.toMatch(/C00\d/);
  });

  it("rejects unsupported files with a clear error", () => {
    expect(() => summarizeOsdrMultiplex("a,b\n1,2")).toThrow(OsdrFormatError);
    expect(() => summarizeOsdrMultiplex("Sample Name,x\nC1_serum_L-3,1")).toThrow(/concentration/);
    expect(() => summarizeOsdrMultiplex("Sample Name,crp_concentration_picogram_per_milliliter\nbad,1")).toThrow(OsdrFormatError);
  });
});

describe("bundled OSD-575 snapshot", () => {
  const snap = OSDR_SNAPSHOTS.find((s) => s.accession === "OSD-575")!;

  it("is identified as real NASA OSDR data with full source information", () => {
    expect(snap.kind).toBe("real-scientific-data");
    expect(snap.repository).toBe("NASA Open Science Data Repository (OSDR)");
    expect(snap.studyUrl).toBe("https://osdr.nasa.gov/bio/repo/data/studies/OSD-575");
    expect(snap.file.downloadUrl).toMatch(/^https:\/\/osdr\.nasa\.gov\//);
    expect(snap.title).toMatch(/Inspiration4/);
    expect(snap.publicReleaseDate).toBeTruthy();
    expect(snap.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("stores the downloaded file verbatim (SHA-256 and size match)", () => {
    const bytes = Buffer.from(snap.content, "utf8");
    expect(bytes.length).toBe(snap.file.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(snap.file.sha256);
  });

  it("summarises 4 crew members, 7 timepoints and 9 cardiovascular analytes", () => {
    const s = summarizeOsdrMultiplex(snap.content);
    expect(s.subjects).toBe(4);
    expect(s.samples).toBe(28);
    expect(s.timepoints).toEqual(["L-92", "L-44", "L-3", "R+1", "R+45", "R+82", "R+194"]);
    expect(s.analytes).toHaveLength(9);
    for (const a of s.analytes) for (const p of a.points) expect(p.n).toBe(4);
  });

  it("never mixes real data with the simulated vital signs", () => {
    for (const sc of Object.values(SCENARIOS)) {
      expect(sc.simulated).toBe(true);
      expect(Object.keys(sc.samples[0]).sort()).toEqual(["hr", "quality", "spo2", "t", "temp"]);
    }
    for (const f of ["src/lib/mission/reducer.ts", "src/lib/scenarios.ts", "src/lib/analysis/engine.ts", "src/state/MissionProvider.tsx"]) {
      expect(readFileSync(join(ROOT, f), "utf8")).not.toMatch(/osdr|science\//i);
    }
  });
});
