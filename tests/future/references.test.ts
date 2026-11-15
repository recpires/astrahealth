/**
 * Official NASA HRR references used by the FUTURE modules, checked offline
 * against the snapshot of the official risk index
 * (refresh online with: npm run future:check-refs -- --write-snapshot).
 */
import { describe, expect, it } from "vitest";
import refs from "@/data/future/hrr-risk-references.json";
import snapshot from "@/data/future/hrr-risk-index.snapshot.json";
import { EVIDENCE_LIBRARY } from "@/config/evidence-library";
import { HRR_REFERENCES, evidenceLevel, libraryItemFor } from "@/features/platform/references";

describe("HRR risk references", () => {
  it("match the official index title-for-title", () => {
    const index = snapshot.risks as Record<string, string>;
    expect(snapshot.url).toBe("https://humanresearchroadmap.nasa.gov/Risks/");
    expect(snapshot.sha256).toMatch(/^[0-9a-f]{64}$/);
    for (const r of refs.entries) {
      expect(index[String(r.hrrId)], r.id).toBe(r.title);
      expect(r.url).toBe(`https://humanresearchroadmap.nasa.gov/Risks/?i=${r.hrrId}`);
      expect(r.id).toBe(`hrr-${r.hrrId}`);
    }
  });

  it("are unique and say that the association is the team's, not NASA's", () => {
    expect(new Set(HRR_REFERENCES.map((r) => r.id)).size).toBe(HRR_REFERENCES.length);
    expect(refs.description).toMatch(/chosen by Team ANGARIS; it is not a NASA statement/);
    expect(refs.description).toMatch(/shows no excerpt from them/);
  });

  it("link to the verified evidence library only where that library covers the same HRR risk page", () => {
    for (const r of HRR_REFERENCES.filter((x) => x.libraryId)) {
      const item = libraryItemFor(r)!;
      expect(item, r.id).toBeDefined();
      expect(item.links.some((l) => l.url === r.url), r.id).toBe(true);
      expect(evidenceLevel(r)).toBe("verified-excerpts");
    }
    expect(HRR_REFERENCES.filter((r) => evidenceLevel(r) === "verified-excerpts").map((r) => r.libraryId).sort()).toEqual(EVIDENCE_LIBRARY.map((e) => e.id).sort());
  });
});
