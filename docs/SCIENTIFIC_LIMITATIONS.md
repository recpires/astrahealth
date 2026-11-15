# Scientific limitations

ASTRA Health is a **hackathon demonstration prototype**. Read this before presenting or reusing any part of it.

## What the prototype is NOT

- **Not a medical device** and not intended for diagnosis, monitoring of real patients or any clinical decision.
- **Not clinically validated.** No rule, threshold or procedure has been evaluated by clinicians or against real data.
- **Not connected to real sensors or spacecraft.** All data and all communication are simulated.

## Data

- All vital-sign values are **synthetic**, produced by `scripts/generate-scenarios.mjs` from smooth curves plus seeded
  pseudo-random noise (seeds 1101, 2202, 3303). They do not come from any person, mission or NASA dataset.
- Signal-quality indices, dropouts and the confirmation reading are scripted parts of the scenarios.
- Only three scenarios exist. Real physiology and real sensor artifacts are far more varied (motion, sweat, microgravity
  fluid shifts, electromagnetic interference, calibration drift…).

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
