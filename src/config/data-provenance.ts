/**
 * Where every kind of content in ASTRA Health comes from.
 * Shown on the Science & Limits page and documented in the README.
 */
import type { ProvenanceKind } from "@/lib/science/types";

export interface ProvenanceEntry {
  item: string;
  kind: ProvenanceKind;
  source: string;
  usedBy: string;
}

export const PROVENANCE_KINDS: Record<ProvenanceKind, { label: string; description: string }> = {
  "simulated-data": {
    label: "Simulated data",
    description: "Synthetic values produced for the demonstration. Not measured on any person.",
  },
  "real-scientific": {
    label: "Real scientific data & evidence",
    description: "Official NASA documents and public datasets, shown with source, link and limitations. Context only.",
  },
  "demo-rule": {
    label: "Demonstration rules",
    description: "Thresholds, rules, checklists and timings written by the team. Provisional, not clinically validated, not NASA-approved.",
  },
};

export const PROVENANCE: ProvenanceEntry[] = [
  {
    item: "Heart rate, SpO₂ and temperature streams, signal quality, dropouts",
    kind: "simulated-data",
    source: "scripts/generate-scenarios.mjs (seeded) → src/data/scenarios/*.json",
    usedBy: "Monitoring, Analysis",
  },
  {
    item: "Confirmation reading and ground acknowledgement",
    kind: "simulated-data",
    source: "Scenario JSON and Earth-link simulator",
    usedBy: "Response, Earth Link",
  },
  {
    item: "Demo reference ranges, caution bands, plausibility limits, analysis rules, reliability score",
    kind: "demo-rule",
    source: "src/config/reference-ranges.ts, src/lib/analysis/ (status PROVISIONAL)",
    usedBy: "Analysis engine",
  },
  {
    item: "Medical-support escalation rules and safety checklists",
    kind: "demo-rule",
    source: "src/lib/response/escalation.ts, src/data/procedures.json",
    usedBy: "Response",
  },
  {
    item: "Earth–Mars delay 3–22 min, 30 s transmission, 2 min ground handling",
    kind: "demo-rule",
    source: "Team brief; src/lib/comms/",
    usedBy: "Earth Link",
  },
  {
    item: "NASA HRP evidence reports — cardiovascular, hypoxia, medical capability",
    kind: "real-scientific",
    source: "humanresearchroadmap.nasa.gov · ntrs.nasa.gov · nasa.gov",
    usedBy: "Science & Limits (context only — no threshold derived)",
  },
  {
    item: "NASA OSDR OSD-575 — Inspiration4 serum cardiovascular biomarker panel",
    kind: "real-scientific",
    source: "osdr.nasa.gov (imported verbatim by scripts/import-osdr.mjs)",
    usedBy: "Science & Limits (display only — never mixed with simulated vital signs)",
  },
];
