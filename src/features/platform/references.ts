/**
 * Scientific references available OFFLINE to the FUTURE modules.
 *
 * Two levels, always shown to the user:
 *  - "verified-excerpts": the risk is covered by an evidence report in the NASA HRP
 *    evidence library (src/data/science), with verbatim quotes checked against the PDF;
 *  - "reference-only": only the official risk title and link are stored (checked
 *    against the HRR risk index by scripts/check-hrr-references.mjs). No content is
 *    summarised or quoted, so any explanation is limited — the UI says so.
 */
import data from "@/data/future/hrr-risk-references.json";
import { EVIDENCE_LIBRARY } from "@/config/evidence-library";
import type { EvidenceItem } from "@/lib/science/types";

export interface RiskReference {
  id: string;
  hrrId: number;
  title: string;
  url: string;
  libraryId: string | null;
}

export type EvidenceLevel = "verified-excerpts" | "reference-only";

export const HRR_REFERENCES: RiskReference[] = data.entries as RiskReference[];
export const HRR_VERIFIED_ON: string = data.verifiedOn;
export const HRR_INDEX_URL: string = data.indexUrl;

export function referenceById(id: string): RiskReference | undefined {
  return HRR_REFERENCES.find((r) => r.id === id);
}

export function libraryItemFor(ref: RiskReference): EvidenceItem | undefined {
  return ref.libraryId ? EVIDENCE_LIBRARY.find((e) => e.id === ref.libraryId) : undefined;
}

export function evidenceLevel(ref: RiskReference): EvidenceLevel {
  return libraryItemFor(ref) ? "verified-excerpts" : "reference-only";
}

export const EVIDENCE_LEVEL_TEXT: Record<EvidenceLevel, string> = {
  "verified-excerpts": "Verified excerpts available",
  "reference-only": "Reference only — content not reviewed",
};
