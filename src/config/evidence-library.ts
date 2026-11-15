/**
 * NASA Human Research Program (HRP) evidence library.
 *
 * The entries live in src/data/science/nasa-hrp-evidence.json so that the
 * verification scripts can read them without running TypeScript:
 *  - npm run science:check-links              → every link answers on the official servers;
 *  - python3 scripts/verify-science-sources.py → titles, dates, authors, risk statements and
 *    quotes are found verbatim in the official PDFs / HRR pages (see docs/SCIENCE_VERIFICATION.md).
 *
 * ASTRA Health uses this evidence as SCIENTIFIC CONTEXT ONLY. No threshold,
 * alarm level, rule or checklist in the application is derived from it
 * (`derivesThresholds: false`, enforced by tests/evidence.test.ts).
 */
import data from "@/data/science/nasa-hrp-evidence.json";
import type { EvidenceItem } from "@/lib/science/types";

export const EVIDENCE_LIBRARY: EvidenceItem[] = data.entries as EvidenceItem[];

export const EVIDENCE_VERIFIED_ON: string = data.verifiedOn;

export const TOPIC_LABEL: Record<EvidenceItem["topic"], string> = {
  cardiovascular: "Cardiovascular",
  hypoxia: "Hypoxia",
  "medical-capability": "Medical capability",
};

/** Every URL in the library (used by scripts/check-evidence-links.mjs and tests). */
export function allEvidenceUrls(): string[] {
  return EVIDENCE_LIBRARY.flatMap((e) => [...e.links, ...e.related].map((l) => l.url));
}
