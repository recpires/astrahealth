/**
 * Parser and summariser for NASA OSDR multiplex "TRANSFORMED" tables
 * (e.g. OSD-575 LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv).
 *
 * Expected layout: a "Sample Name" column such as "C001_serum_L-92"
 * (subject _ matrix _ timepoint) followed by "<analyte>_concentration_<unit>"
 * and "<analyte>_percent" columns.
 *
 * Only per-timepoint summary statistics (n, mean, min, max) are produced;
 * per-person values are never returned. This module is independent from the
 * mission simulation and never touches the simulated vital signs.
 */
import type { AnalyteSummary, OsdrSummary, TimepointSummary } from "@/lib/science/types";

export class OsdrFormatError extends Error {}

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, CRLF, BOM). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const UNIT_LABELS: Record<string, string> = {
  picogram_per_milliliter: "pg/mL",
  nanogram_per_milliliter: "ng/mL",
  microgram_per_milliliter: "µg/mL",
  milligram_per_milliliter: "mg/mL",
  milligram_per_deciliter: "mg/dL",
};

/** Readable names for the analytes of the Eve Technologies cardiovascular panel used in OSD-575. */
const ANALYTE_LABELS: Record<string, string> = {
  a2_macroglobulin: "α2-Macroglobulin",
  agp: "AGP (α1-acid glycoprotein)",
  crp: "CRP (C-reactive protein)",
  fetuin_a36: "Fetuin-A36",
  fibrinogen: "Fibrinogen",
  haptoglobin: "Haptoglobin",
  l_selectin: "L-Selectin",
  pf4: "PF4 (platelet factor 4)",
  sap: "SAP (serum amyloid P)",
};

export function unitLabel(token: string): string {
  return UNIT_LABELS[token] ?? token.replace(/_/g, " ");
}

export function analyteLabel(key: string): string {
  return ANALYTE_LABELS[key] ?? key.replace(/_/g, " ");
}

/** "L-92" → pre-flight day −92; "R+1" → post-flight day +1. */
export function parseTimepoint(tp: string): { phase: TimepointSummary["phase"]; day: number } | null {
  const m = /^([LR])([+-])(\d+)$/.exec(tp.trim());
  if (!m) return null;
  const day = Number(m[3]) * (m[2] === "-" ? -1 : 1);
  return { phase: m[1] === "L" ? "pre-flight" : "post-flight", day };
}

function compareTimepoints(a: string, b: string): number {
  const pa = parseTimepoint(a);
  const pb = parseTimepoint(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa.phase !== pb.phase) return pa.phase === "pre-flight" ? -1 : 1;
  return pa.day - pb.day;
}

export function summarizeOsdrMultiplex(csvText: string): OsdrSummary {
  const rows = parseCsv(csvText);
  if (rows.length < 2) throw new OsdrFormatError("The file has no data rows.");
  const header = rows[0].map((h) => h.trim());
  const sampleIdx = header.findIndex((h) => h.toLowerCase() === "sample name");
  if (sampleIdx < 0) throw new OsdrFormatError('Unsupported file: missing "Sample Name" column (expected an OSDR multiplex TRANSFORMED table).');

  const concentration: { idx: number; key: string; unitToken: string }[] = [];
  const ignoredColumns: OsdrSummary["ignoredColumns"] = [];
  header.forEach((h, idx) => {
    if (idx === sampleIdx) return;
    const m = /^(.+)_concentration_(.+)$/.exec(h);
    if (m) concentration.push({ idx, key: m[1], unitToken: m[2] });
    else
      ignoredColumns.push({
        column: h,
        reason: h.endsWith("_percent")
          ? "Percent columns are not explained in the study metadata, so they are not displayed."
          : "Column not recognised as a concentration measurement.",
      });
  });
  if (concentration.length === 0) throw new OsdrFormatError("Unsupported file: no \"<analyte>_concentration_<unit>\" columns found.");

  const subjects = new Set<string>();
  const values = new Map<string, Map<string, number[]>>(); // analyte → timepoint → values
  let samples = 0;
  for (const row of rows.slice(1)) {
    const name = (row[sampleIdx] ?? "").trim();
    const parts = name.split("_");
    if (parts.length < 3) throw new OsdrFormatError(`Unexpected sample name "${name}" (expected subject_matrix_timepoint).`);
    const timepoint = parts[parts.length - 1];
    if (!parseTimepoint(timepoint)) throw new OsdrFormatError(`Unexpected timepoint "${timepoint}" in sample "${name}".`);
    subjects.add(parts[0]);
    samples++;
    for (const c of concentration) {
      const raw = (row[c.idx] ?? "").trim();
      if (raw === "") continue;
      const v = Number(raw);
      if (!Number.isFinite(v)) continue;
      if (!values.has(c.key)) values.set(c.key, new Map());
      const byTp = values.get(c.key)!;
      if (!byTp.has(timepoint)) byTp.set(timepoint, []);
      byTp.get(timepoint)!.push(v);
    }
  }

  const timepoints = [...new Set([...values.values()].flatMap((m) => [...m.keys()]))].sort(compareTimepoints);
  const analytes: AnalyteSummary[] = concentration.map((c) => {
    const byTp = values.get(c.key) ?? new Map<string, number[]>();
    const points: TimepointSummary[] = [...byTp.keys()].sort(compareTimepoints).map((tp) => {
      const v = byTp.get(tp)!;
      const p = parseTimepoint(tp)!;
      return {
        timepoint: tp,
        phase: p.phase,
        day: p.day,
        n: v.length,
        mean: v.reduce((a, b) => a + b, 0) / v.length,
        min: Math.min(...v),
        max: Math.max(...v),
      };
    });
    return { key: c.key, label: analyteLabel(c.key), unitToken: c.unitToken, unit: unitLabel(c.unitToken), points };
  });

  return { subjects: subjects.size, samples, timepoints, analytes, ignoredColumns };
}

/** Number formatting with digit grouping (no "k"/"M" suffixes, which could be misread as units). */
export function formatConcentration(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: Math.abs(v) >= 100 ? 0 : 2 });
}
