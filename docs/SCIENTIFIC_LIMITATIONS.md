# Scientific limitations

ASTRA Health is a **hackathon demonstration prototype**. Read this before presenting or reusing any part of it.

## What the prototype is NOT

- **Not a medical device** and not intended for diagnosis, monitoring of real patients or any clinical decision.
- **Not clinically validated.** No rule, threshold or procedure has been evaluated by clinicians or against real data.
- **Not connected to real sensors or spacecraft.** All data and all communication are simulated.

## Data

- All vital-sign values are **synthetic**, produced by `scripts/generate-scenarios.mjs` from smooth curves plus seeded
  pseudo-random noise (seeds 1101, 2202, 3303). They do not come from any person, mission or NASA dataset.
- The only real measurements in the app are the **NASA OSDR OSD-575** summaries shown in *Science & Limits*: serum
  cardiovascular biomarkers from four private astronauts of a 3-day low-Earth-orbit mission (Inspiration4). They are
  displayed as per-timepoint summary statistics only, are not used by the analysis engine and are not representative of
  long-duration Mars missions.
- Signal-quality indices, dropouts and the confirmation reading are scripted parts of the scenarios.
- Only three scenarios exist. Real physiology and real sensor artifacts are far more varied (motion, sweat, microgravity
  fluid shifts, electromagnetic interference, calibration drift…).

## Scientific evidence

- The NASA Human Research Program evidence reports listed in *Science & Limits* are cited as **context only**. Quotes are
  verbatim and linked; the official documents remain the authoritative source and may be updated by NASA.
- No threshold, rule or checklist is derived from them (`derivesThresholds: false`, enforced by tests), and no checklist
  is presented as NASA-approved.
- Evidence reports summarise research up to their approval date (2017, 2022 and 2023 for the three reports used).

## Analysis rules

- Thresholds in `src/config/reference-ranges.ts` are **provisional placeholders** chosen by the development team so the
  rule engine can be demonstrated (status `PROVISIONAL`). They are general-purpose round numbers, not values taken from a
  NASA standard or from the official challenge statement.
- The engine is deterministic: range check with persistence (3 samples) and hysteresis, dropouts, plausibility limits,
  maximum step between samples, signal quality, frozen value (heart rate only) and a cross-check that reclassifies an
  out-of-range value from a suspect sensor as an *inconsistent reading*.
- Attention levels (NOMINAL / ADVISORY / CAUTION / WARNING) are demonstration categories, **not clinical triage levels**.
- The *data reliability* score measures data quality (signal quality minus rule penalties; overall = weakest vital). It
  does **not** express certainty about the crew member's health.
- Temperature is a single "body (skin) temperature" stream; skin and core temperature differ in reality.

## Response and escalation

- Checklists in `src/data/procedures.json` are illustrative safety steps written for the demo. They are **not approved
  NASA flight procedures** and contain no medication, dosing, treatment or clinical intervention (enforced by
  `tests/science.test.ts`).
- Escalation rules only say *when* to involve the Crew Medical Officer and the ground flight surgeon. The 3-minute
  persistence rule and the other escalation triggers are demonstration choices.

## Communication

- The 3–22 minute one-way delay range comes from the team brief. Real Earth–Mars light time depends on planetary
  geometry, and the link can be unavailable for extended periods (e.g. around solar conjunction). Both must be
  cross-checked against the confirmed NASA resource.
- Transmission time (30 s per message) and ground handling time (2 min) are arbitrary simulation constants.
- Ground replies are automatic placeholders; **no person reviews any message**.
- Light-travel distance is computed as delay × speed of light (exact physics, not a planetary ephemeris).

## Engineering

- No authentication, persistence, encryption, audit-grade logging or medical-device quality processes (IEC 62304,
  ISO 14971, etc.).
- State lives in browser memory and resets on reload.

## What must happen before any scientific claim

1. Team ANGARIS confirms the official challenge statement and selects one NASA resource.
2. The resource is registered in `src/config/scientific-sources.ts` with name, origin, URL/DOI, version, access date and
   effective use (see [NASA_RESOURCE.md](NASA_RESOURCE.md)).
3. Thresholds and rules are updated from the resource, `REFERENCE_CONFIG.status` is set to `CONFIRMED` with a precise
   `provenance`, and the tests are updated accordingly.
4. Any remaining value not supported by the resource stays labelled as provisional.

## FUTURE modules (platform preview)

- The journal rules (`ASTRA-JOURNAL@0.1.0-demo`), symptom rule set (`ASTRA-SYM@0.1.0-demo`), health-profile definitions and EVA protocol (`ASTRA-EVA@0.1.0-demo`) are demonstration content written by the team. They are marked PROVISIONAL, are not NASA procedures and are not clinically validated. Every threshold and interval in them is a demonstration value.
- The symptom engine proposes next steps and when to contact medical support; it never names a condition, a medication or a treatment, always states its uncertainty, and every proposal needs a human decision.
- The Space Health Profile never simulates or estimates values that need equipment the demo does not have (e.g. intracranial pressure, bone mineral density, kidney imaging); it shows the exam required and "no data". Equipment availability is a demonstration assumption.
- 15 official NASA Human Research Roadmap risks are referenced by title and link (checked against the official index). Only the three covered by the verified evidence library are quoted; the others are reference-only. Which risk is shown for a symptom, domain or EVA step was chosen by the team and is not a NASA statement.
- All crew data in these modules are simulated (demo seed) or typed in during the demo. Details: [docs/future/README.md](future/README.md).
