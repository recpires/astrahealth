/**
 * The NASA HRP evidence library must stay verifiable and must never be used
 * to derive clinical limits.
 */
import { describe, expect, it } from "vitest";
import { EVIDENCE_LIBRARY, allEvidenceUrls } from "@/config/evidence-library";
import { PROVENANCE } from "@/config/data-provenance";
import { REFERENCE_CONFIG } from "@/config/reference-ranges";

const OFFICIAL_HOSTS = new Set(["humanresearchroadmap.nasa.gov", "ntrs.nasa.gov", "www.nasa.gov"]);

describe("NASA HRP evidence library", () => {
  it("covers cardiovascular risk, hypoxia and medical capability", () => {
    const topics = new Set(EVIDENCE_LIBRARY.map((e) => e.topic));
    expect(topics).toEqual(new Set(["cardiovascular", "hypoxia", "medical-capability"]));
  });

  it("gives every entry a title, source, date, link and limitations", () => {
    for (const e of EVIDENCE_LIBRARY) {
      expect(e.title).toMatch(/^Evidence Report: Risk of /);
      expect(e.source).toMatch(/NASA Human Research Program/);
      expect(e.date).toMatch(/Approved for public release/);
      expect(e.links[0].kind).toBe("pdf");
      expect(e.limitations.length).toBeGreaterThanOrEqual(3);
      expect(e.riskStatement.text).toMatch(/^Given /);
      expect(e.riskStatement.where).toMatch(/HRR risk page/);
      expect(e.keyQuotes.length).toBeGreaterThan(0);
      expect(e.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("only links to official NASA hosts over HTTPS", () => {
    for (const url of allEvidenceUrls()) {
      const u = new URL(url);
      expect(u.protocol).toBe("https:");
      expect(OFFICIAL_HOSTS.has(u.hostname)).toBe(true);
    }
  });

  it("never derives thresholds and never claims NASA approval", () => {
    for (const e of EVIDENCE_LIBRARY) {
      expect(e.derivesThresholds).toBe(false);
      expect(e.useInAstra).toMatch(/\b(not|No)\b[^.]*(taken|derived) from this report/);
      expect(`${e.useInAstra} ${e.limitations.join(" ")}`).not.toMatch(/NASA[- ]approved|approved by NASA/i);
    }
    // Thresholds stay provisional demonstration values.
    expect(REFERENCE_CONFIG.status).toBe("PROVISIONAL");
  });

  it("classifies every piece of content into exactly one provenance kind", () => {
    const kinds = new Set(PROVENANCE.map((p) => p.kind));
    expect(kinds).toEqual(new Set(["simulated-data", "real-scientific", "demo-rule"]));
    expect(PROVENANCE.find((p) => /reference ranges/i.test(p.item))?.kind).toBe("demo-rule");
    expect(PROVENANCE.find((p) => /Heart rate, SpO₂/.test(p.item))?.kind).toBe("simulated-data");
    expect(PROVENANCE.find((p) => /OSDR/.test(p.item))?.kind).toBe("real-scientific");
  });
});
