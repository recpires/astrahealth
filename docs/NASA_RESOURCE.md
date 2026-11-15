# NASA scientific resources — integration guide

ASTRA Health integrates real NASA science in **two clearly separated ways**, and keeps a third slot reserved:

| Resource | Status | Where | Role in the app |
|---|---|---|---|
| NASA Human Research Program (HRP) evidence library | **Integrated** (verified 2026-11-15) | `src/data/science/nasa-hrp-evidence.json` (typed in `src/config/evidence-library.ts`) | Scientific context in *Science & Limits*; no threshold derived |
| NASA OSDR dataset OSD-575 | **Integrated** (imported 2026-11-15) | `src/data/osdr/OSD-575.json` | Real data shown in *Science & Limits*; never mixed with simulated vital signs |
| NASA source for the analysis thresholds | **Pending team confirmation** | `src/config/scientific-sources.ts` | Empty — all thresholds remain provisional demonstration values |

Verification of all sources, the imported file and the statistics: [SCIENCE_VERIFICATION.md](SCIENCE_VERIFICATION.md).

## 1. HRP evidence library

Each entry records title, document type, source (programme · element · center), authors, date as printed on the
document, primary link (PDF on the Human Research Roadmap), the HRR risk page, related official records (NTRS), the
**verbatim** risk statement from the HRR risk page, **verbatim** key quotes, how ASTRA Health uses it, its limitations
and the verification date.

| Topic | Evidence report | Date on document |
|---|---|---|
| Cardiovascular | Evidence Report: Risk of Cardiovascular Adaptations Contributing to Adverse Mission Performance and Health Outcomes | Approved for public release: December 15, 2022 |
| Hypoxia | Evidence Report: Risk of Reduced Crew Health and Performance Due to Decompression Sickness and Hypoxia | Approved for public release: October 31, 2023 |
| Medical capability | Evidence Report: Risk of Adverse Health Outcomes and Decrements in Performance due to In-Flight Medical Conditions | Approved for public release: May 8, 2017 |

Rules enforced by `tests/evidence.test.ts`:

- links use HTTPS on official hosts only (`humanresearchroadmap.nasa.gov`, `ntrs.nasa.gov`, `www.nasa.gov`);
- every entry has a PDF link, a risk statement, key quotes and at least three limitations;
- `derivesThresholds` is `false` for every entry and no text claims NASA approval;
- the reference ranges stay `PROVISIONAL`.

To add or update an entry:

1. Open the official document (HRR evidence page or NTRS) and copy title, date and authors exactly.
2. Copy the risk statement from the HRR risk page and any quote **verbatim** (mark omissions with "…" and original typos with "[sic]").
3. Write how ASTRA Health uses it and its limitations; keep `derivesThresholds: false`.
4. The entries live in `src/data/science/nasa-hrp-evidence.json`. Update `verifiedOn`, then run `npm run science:check-links`, `python3 scripts/verify-science-sources.py` and `npm test`.

## 2. NASA OSDR dataset

- **Study:** OSD-575 — *SpaceX Inspiration4 Blood Serum Metabolic Panel and Immune/Cardiac Cytokine Arrays (Comprehensive Metabolic Panel and Multiplex)* — public release 14 May 2024 — <https://osdr.nasa.gov/bio/repo/data/studies/OSD-575>.
- **File:** `LSDS-8_Multiplex_serum_cardiovascular_EvePanel_TRANSFORMED.csv` (ALSDA Transformed Files).
- **Import:** `npm run osdr:import -- OSD-575` (use `--list` to list the files, `--file <name>` to choose another). The script calls the official OSDR API (`/osdr/data/osd/meta/<n>`, `/osdr/data/osd/files/<n>`), downloads the file and stores it **verbatim** with accession, title, study/API/download URLs, public-release date, mission, publications, retrieval date, size and SHA-256. Behind an HTTP proxy, prefix the command with `NODE_USE_ENV_PROXY=1`.
- **Display:** only per-timepoint summary statistics (n, mean, min, max). No per-person values, reference ranges or clinical interpretation. `_percent` columns are not displayed because their meaning is not described in the study metadata.
- **Separation:** `src/data/osdr/` is never imported by the simulation, analysis or report modules (`tests/osdr.test.ts`).
- **In-app import:** users can load another OSDR multiplex table from a local file; the accession is required and the data stays in the browser only.
- **Browser limitation:** the OSDR API answers browser requests only for the `osdr.nasa.gov` origin (CORS), so live download from the deployed app is not possible.

## 3. Source for analysis thresholds (pending)

`NASA_RESOURCE` in `src/config/scientific-sources.ts` is reserved for a NASA source of **numeric limits**. It stays empty
until Team ANGARIS confirms the official challenge statement. Neither the evidence library nor OSD-575 is used for that
purpose. When a source is confirmed:

1. Fill every field of `NASA_RESOURCE` (name, origin, URL/DOI, version, access date, effective use, verifier) and set `status: "confirmed"`.
2. Update only the values in `src/config/reference-ranges.ts` that the source supports, set `status: "CONFIRMED"` and write a precise `provenance` (section/table). Leave unsupported values marked as provisional.
3. Run `npm test` — `tests/science.test.ts` requires every registry field once `status` is `confirmed`; adjust scenario tests if detections change.
4. Update `docs/SCIENTIFIC_LIMITATIONS.md` and the *Scientific basis & limitations* section of `README.md` and `README.pt-BR.md`.
