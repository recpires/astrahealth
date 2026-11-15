# Science verification report

**Date:** 2026-11-15 · **Scope:** the NASA HRP evidence library and the NASA OSDR dataset OSD-575 used in *Science & Limits*.

All checks were run against **freshly downloaded official files**, with two tools that do not use the application code:

```bash
npm run science:check-links                    # Node.js — every link answers on the official servers
pip install pypdf
python3 scripts/verify-science-sources.py      # Python — texts, file integrity, units and statistics
```

Behind an HTTP proxy, prefix the Node command with `NODE_USE_ENV_PROXY=1`.

## Results

| Check | Method | Result |
|---|---|---|
| Links of the evidence library and the OSDR snapshot | HTTP request, page title / content type | **17/17** |
| Titles, approval dates and author surnames | Found in the official PDFs (whitespace ignored) | **9/9** |
| Risk statements | Found verbatim on the Human Research Roadmap risk pages | **3/3** |
| Key quotes | Found verbatim in the PDF or HRR page named as their source | **10/10** |
| OSD-575 title and public-release date | Compared with the OSDR metadata API | **2/2** |
| Stored CSV vs fresh download | Size, SHA-256 and byte-for-byte comparison | **3/3** — SHA-256 `fdba6c3c…d9cfc75c` |
| Transformed vs submitted file | The ISA metadata declares `LSDS-8_Multiplex_serum.cardiovascular.EvePanel_SUBMITTED.csv`; every value and unit compared | **252/252 values identical, 9/9 units consistent** |
| Statistics (n, mean, min, max) | Recomputed in Python from the *submitted* file and compared with `tests/fixtures/OSD-575-expected-summary.json` | **63 groups × 4 statistics** match (largest relative difference 2.1 × 10⁻¹⁶, floating-point rounding) |
| Application statistics | The TypeScript parser output is compared with the same fixture in `tests/osdr.test.ts` (offline, every `npm test`) | **pass** |

The Python script reported **32/32 checks passed**.

### Negative control

To make sure the checks are not vacuous, a temporary copy of the project was altered on purpose: one quote had its meaning
reversed ("inconclusive" → "conclusive"), one digit of the stored CSV was changed and one statistic of the fixture was
increased by 0.1 %. The script reported the three failures (**29/32**).

### Dataset details confirmed from the official metadata

- **Assay:** Human Cardiovascular Disease Panel 3 9-Plex Discovery Assay® Array (HDCVD9), Eve Technologies (Calgary, Canada); serum stored at −80 °C.
- **Units** (submitted file): ng/mL — α2-Macroglobulin, AGP, Fetuin-A36, Fibrinogen, Haptoglobin, PF4; pg/mL — CRP, L-Selectin, SAP.
- **Design:** 4 crew members (coded C001–C004) × 7 timepoints. The study description lists L-92, L-44, L-3, R+1, R+45 and R+82; both the submitted and the transformed files also contain **R+194**, which the app displays as found in the data.

## What this verification does NOT establish

- **Analysis thresholds remain unvalidated.** The *Source for analysis thresholds* registry is still **pending confirmation**; the reference ranges, caution bands and rules of the analysis engine are provisional demonstration values with no validated clinical basis. Neither the evidence library nor OSD-575 is used to set them.
- **No clinical validation** of rules, escalation logic or checklists, and no claim of NASA approval.
- The quotes are accurate **excerpts**, not a summary of the full reports. NASA may update the documents (the HRR risk pages were last published on 05/13/2025).
- The OSD-575 statistics are **descriptive** (n = 4, a 3-day low-Earth-orbit mission of private astronauts). No inferential or clinical conclusion is drawn; the `_percent` columns are not displayed because their meaning is not described in the study metadata.
- PDF text is matched after extraction with `pypdf`, ignoring whitespace; layout or OCR issues in future versions of the PDFs could require adjusting the quotes.
