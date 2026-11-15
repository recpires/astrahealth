/**
 * OSDR snapshots bundled with the application (written by scripts/import-osdr.mjs).
 * Kept separate from src/data/scenarios: real data never feeds the simulation.
 */
import osd575 from "@/data/osdr/OSD-575.json";
import type { OsdrSnapshot } from "@/lib/science/types";

export const OSDR_SNAPSHOTS: OsdrSnapshot[] = [osd575 as OsdrSnapshot];

export function getOsdrSnapshot(accession: string): OsdrSnapshot | undefined {
  return OSDR_SNAPSHOTS.find((s) => s.accession === accession);
}
