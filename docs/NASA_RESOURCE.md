# NASA scientific resource — integration guide

**Status: PENDING TEAM CONFIRMATION.** No NASA resource is integrated yet and none is claimed anywhere in the app,
the report or the documentation.

The project brief requires integrating one real NASA scientific resource and forbids inventing data, sources or
results. Team ANGARIS will confirm the official NASA Space Apps 2026 challenge statement before the analysis rules are
finalised. The architecture is ready for that step.

## Where the resource plugs in

| File | Role | Current content |
|------|------|-----------------|
| `src/config/scientific-sources.ts` | Registry: name, origin, URL/DOI, version, access date, effective use, integration points, verifier | All fields `null`, `status: "pending-confirmation"` |
| `src/config/reference-ranges.ts` | Thresholds used by the rule engine | `status: "PROVISIONAL"` placeholder values |
| `src/data/procedures.json` | Demonstration safety checklists | Team-written, labelled as not approved procedures |
| `src/lib/comms/delay.ts` | Earth–Mars delay range | 3–22 min from the team brief |
| `src/lib/report/incident-report.ts` | `scientificBasis` section of every report | Reads the registry automatically |
| `src/components/science/ScienceView.tsx` | `/science` page | Reads the registry automatically |
| `tests/science.test.ts` | Guards against unconfirmed claims | Passes while the registry is empty |

## How to register the confirmed resource

1. Verify the resource yourself on the official NASA page (name, publisher/programme, URL or DOI, version/revision).
2. Fill `NASA_RESOURCE` in `src/config/scientific-sources.ts`:

   ```ts
   export const NASA_RESOURCE: NasaResourceRecord = {
     status: "confirmed",
     name: "<official name>",
     origin: "<NASA programme / center / publisher>",
     url: "<canonical URL or DOI>",
     version: "<revision or publication date>",
     accessedOn: "<YYYY-MM-DD>",
     effectiveUse: "<exactly what the app takes from it, e.g. which values feed reference-ranges.ts>",
     integrationPoints: ["src/config/reference-ranges.ts — …"],
     verifiedBy: "<team member>",
   };
   ```

3. Update the values in `src/config/reference-ranges.ts` that the resource supports, set `status: "CONFIRMED"` and write
   a precise `provenance` (section/table of the resource). Leave unsupported values clearly marked as provisional.
4. Run `npm test`. `tests/science.test.ts` requires every registry field to be filled once `status` is `confirmed`.
   Adjust the scenario tests if thresholds change the expected detections.
5. Update `docs/SCIENTIFIC_LIMITATIONS.md` and the README "Scientific status" section.

## Candidate resources (for the team to evaluate — NOT integrated, NOT verified here)

The following are well-known NASA resources in the space-health domain that the team may consider. Their names are
listed only as starting points: this repository has not verified their current URLs, content or licensing (network
access to nasa.gov was not available during development), and none of their data is used.

- NASA-STD-3001 — NASA Space Flight Human-System Standard (Volume 1: Crew Health; Volume 2: Human Factors, Habitability
  and Environmental Health).
- NASA Human Research Program (HRP) — Human Research Roadmap (risks and gaps for exploration missions).
- NASA Open Science Data Repository (OSDR), which includes GeneLab and ALSDA.
- NASA Life Sciences Data Archive (LSDA).

Whatever is chosen must be recorded with its **name, origin and effective use** exactly as described above.
