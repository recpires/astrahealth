/**
 * Scientific resource registry.
 *
 * The prompt for this project requires integrating ONE real NASA scientific
 * resource, and forbids inventing data, sources or results. Until Team ANGARIS
 * confirms which resource will be used, every field stays empty and the app
 * shows "Pending team confirmation".
 *
 * HOW TO REGISTER THE CONFIRMED RESOURCE
 * 1. Fill every field of `NASA_RESOURCE` below with verified information.
 * 2. Set `status` to "confirmed".
 * 3. Describe in `effectiveUse` exactly what the app takes from the resource
 *    (e.g. which values feed `src/config/reference-ranges.ts`).
 * 4. Update docs/NASA_RESOURCE.md and the tests in tests/science.test.ts.
 */

export type ResourceStatus = "pending-confirmation" | "confirmed";

export interface NasaResourceRecord {
  status: ResourceStatus;
  /** Official name of the NASA resource (dataset, standard, publication, API…). */
  name: string | null;
  /** Organisation / programme that publishes it. */
  origin: string | null;
  /** Canonical URL or DOI. */
  url: string | null;
  /** Version, revision or publication date of the resource that was used. */
  version: string | null;
  /** Date (ISO 8601) the team accessed the resource. */
  accessedOn: string | null;
  /** What the application actually uses from the resource. */
  effectiveUse: string | null;
  /** Files in this repository that consume the resource. */
  integrationPoints: string[];
  /** Person or role on the team who verified the information. */
  verifiedBy: string | null;
}

export const NASA_RESOURCE: NasaResourceRecord = {
  status: "pending-confirmation",
  name: null,
  origin: null,
  url: null,
  version: null,
  accessedOn: null,
  effectiveUse: null,
  integrationPoints: [
    "src/config/reference-ranges.ts — analysis thresholds (currently provisional placeholders)",
    "src/data/procedures.json — demonstration safety checklists",
    "src/lib/comms/delay.ts — Earth–Mars delay range (3–22 min per the team brief)",
  ],
  verifiedBy: null,
};

export function isResourceConfirmed(resource: NasaResourceRecord = NASA_RESOURCE): boolean {
  return (
    resource.status === "confirmed" &&
    Boolean(
      resource.name &&
        resource.origin &&
        resource.url &&
        resource.version &&
        resource.accessedOn &&
        resource.effectiveUse &&
        resource.verifiedBy,
    )
  );
}

/** Values that are stated in the team brief rather than taken from a NASA resource. */
export const TEAM_BRIEF_ASSUMPTIONS = [
  {
    topic: "Earth–Mars one-way signal delay",
    value: "Approximately 3 to 22 minutes per direction",
    origin: "ASTRA Health team brief (to be cross-checked against the confirmed NASA resource)",
  },
] as const;
