/**
 * Types for the Science & Limits section.
 *
 * ASTRA Health keeps three kinds of content strictly apart:
 *  - "simulated-data"  — synthetic vital signs and simulator outputs (demonstration only);
 *  - "real-scientific" — real NASA documents and datasets, shown with full source identification;
 *  - "demo-rule"       — thresholds, rules and checklists written for the demonstration.
 */

export type ProvenanceKind = "simulated-data" | "real-scientific" | "demo-rule";

export type EvidenceTopic = "cardiovascular" | "hypoxia" | "medical-capability";

export interface EvidenceLink {
  label: string;
  url: string;
  kind: "pdf" | "risk-page" | "record" | "overview";
}

export interface EvidenceQuote {
  /** Verbatim text from the source ("…" marks omitted text, [sic] marks an original typo). */
  text: string;
  /** Where the quote comes from. */
  where: string;
}

export interface EvidenceItem {
  id: string;
  topic: EvidenceTopic;
  /** Exact title of the primary document. */
  title: string;
  documentType: string;
  /** Publishing organisation, programme and element. */
  source: string;
  authors: string;
  /** Date as printed on the document. */
  date: string;
  /** Primary link first. */
  links: EvidenceLink[];
  /** Earlier or related official records (e.g. previous versions merged into this risk). */
  related: EvidenceLink[];
  /** Official risk statement, verbatim from the Human Research Roadmap risk page. */
  riskStatement: EvidenceQuote;
  keyQuotes: EvidenceQuote[];
  /** What ASTRA Health actually does with this evidence. */
  useInAstra: string;
  /** ASTRA Health derives NO numeric threshold from any evidence item. Kept explicit and tested. */
  derivesThresholds: false;
  limitations: string[];
  /** Date the links and quotes were last checked against the official source (ISO 8601). */
  verifiedOn: string;
}

/** Snapshot written by scripts/import-osdr.mjs (content stored verbatim). */
export interface OsdrSnapshot {
  kind: "real-scientific-data";
  repository: string;
  accession: string;
  title: string;
  description: string;
  studyUrl: string;
  metadataApiUrl: string;
  filesApiUrl: string;
  publicReleaseDate: string | null;
  mission: { name: string | null; start: string | null; end: string | null };
  factors: string[];
  publications: { title: string; doi: string | null }[];
  file: {
    name: string;
    category: string;
    subcategory: string | null;
    subdirectory: string | null;
    downloadUrl: string;
    bytes: number;
    sha256: string;
  };
  retrievedOn: string;
  importedWith: string;
  content: string;
}

export interface TimepointSummary {
  /** Label as written in the dataset, e.g. "L-92" or "R+1". */
  timepoint: string;
  /** Days relative to launch (L) or return (R); negative before launch. */
  phase: "pre-flight" | "post-flight";
  day: number;
  n: number;
  mean: number;
  min: number;
  max: number;
}

export interface AnalyteSummary {
  /** Column key in the dataset, e.g. "crp". */
  key: string;
  label: string;
  /** Original unit token, e.g. "picogram_per_milliliter". */
  unitToken: string;
  unit: string;
  points: TimepointSummary[];
}

export interface OsdrSummary {
  subjects: number;
  samples: number;
  timepoints: string[];
  analytes: AnalyteSummary[];
  /** Columns present in the file but not displayed, with the reason. */
  ignoredColumns: { column: string; reason: string }[];
}
