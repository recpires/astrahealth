# Architecture

## Principles

- **Pure core, thin UI.** All domain logic lives in `src/lib` as pure TypeScript functions. React components only render
  derived state and dispatch actions. This makes every scenario testable end-to-end without a browser.
- **One simulated clock.** A single mission clock (seconds of mission elapsed time) drives vital-sign playback, the
  analysis engine and the Earth-link queue, so timestamps across modules are consistent.
- **Configuration over code.** Thresholds, the NASA resource registry, scenarios and procedures are data
  (`src/config`, `src/data`) and can be replaced without touching the engines.
- **Deterministic.** Seeded data, rule-based analysis, no randomness at runtime, no AI model in the app.

## Data flow

```
                 ┌──────────────────────── MissionProvider (React context, 250 ms tick) ───────────────────────┐
                 │                                                                                              │
 scenarios/*.json ─► sampleAt(tick) ─► missionHistory ─► analyze() ─► diffFindings() ─► events / openedAt      │
                 │                                         │                                                   │
                 │                                         ▼                                                   │
                 │                         applyConfirmations(confirmations)  ◄── TAKE_CONFIRMATION_READING     │
                 │                                         │                                                   │
                 │                         assessMedicalSupport() ─► selectProcedures()                         │
                 │                                         │                                                   │
                 │                         buildIncidentReport() ─► QUEUE_MESSAGE ─► advanceQueue(clock, link) │
                 └──────────────────────────────────────────────────────────────────────────────────────────────┘
       MEASURE (/)            UNDERSTAND (/analysis)          ACT (/response)            COMMUNICATE (/comms)
```

## Mission state machine — `src/lib/mission/reducer.ts`

| Action | Effect |
|--------|--------|
| `TICK(dtRealSec)` | Advances the clock by `dt × timeScale`; analyses every new sample; records events; assigns transmission slots. |
| `START_SCENARIO(id)` | Starts a scenario run (anchors sample ticks to the current clock); resets findings, actions, confirmations; keeps message history. |
| `TOGGLE_STEP` | Completes/reopens a checklist step and logs it. |
| `TAKE_CONFIRMATION_READING` / `REPORT_UNABLE_TO_CONFIRM` | Records the crew confirmation outcome and logs it. |
| `QUEUE_MESSAGE` | Adds a report or crew note to the transmission queue. |
| `SET_DELAY`, `SET_LINK` | Earth-link configuration (delay is locked per message at transmission). |
| `SET_RUNNING`, `SET_TIME_SCALE` | Pause / speed (1×, 10×, 30×, 60×). |

`deriveView(state)` returns the effective analysis (after confirmations), the medical-support assessment and the selected
procedures. `buildReportFromState` snapshots everything into an `ASTRA-IR/0.1` report.

Non-looping scenarios hold their last sample when the recording ends; the clock (and the Earth link) keeps running.

## Analysis engine — `src/lib/analysis/engine.ts`

Evaluated on the last 24 samples for each vital sign:

| Rule | Trigger | Category | Level |
|------|---------|----------|-------|
| `VITAL_OUT_OF_RANGE` | 3 consecutive valid samples outside the demo range (same side); clears after 3 back inside | vital deviation | CAUTION, or WARNING if the last 3 are beyond the caution band |
| `SENSOR_DROPOUT` | Missing readings in the last 10 samples | sensor | ADVISORY (1) / CAUTION (≥2) |
| `SENSOR_IMPLAUSIBLE` | Value outside plausibility limits | sensor | CAUTION, needs confirmation |
| `SENSOR_ABRUPT_CHANGE` | Step between consecutive valid samples > max step | sensor | ADVISORY (1) / CAUTION (≥2), needs confirmation |
| `SENSOR_LOW_QUALITY` | Mean quality of last 3 samples < 60 % (poor < 40 %) | sensor | ADVISORY / CAUTION |
| `SENSOR_FLATLINE` | Heart rate identical for 12 samples | sensor | CAUTION, needs confirmation |
| `READING_INCONSISTENT` | Out-of-range value while the same sensor is suspect | sensor | CAUTION, needs confirmation (replaces the deviation) |

Data reliability: per vital = current quality × 100 − rule penalties (+3 when ≥2 reliable deviations corroborate each
other); overall = weakest vital. Labels: High ≥ 80, Medium ≥ 55, Low otherwise.

### Crew confirmation — `src/lib/analysis/confirmation.ts`

- **artifact** (confirmation reading inside the demo range): findings for that sensor opened before the confirmation are
  moved to *resolved*, the sensor is excluded, an ADVISORY `SENSOR_EXCLUDED` finding remains.
- **confirmed** (reading outside the range): `READING_INCONSISTENT` becomes a `VITAL_CONFIRMED` vital deviation.
- **unable**: findings stay; escalation recommends medical support.

## Escalation — `src/lib/response/escalation.ts`

| Urgency | When |
|---------|------|
| `urgent` | Any reliable vital deviation at WARNING |
| `recommended` | ≥2 simultaneous deviations, a deviation persisting ≥3 min, a confirmed deviation, or an inconsistent reading the crew could not verify |
| `monitor` | Single CAUTION deviation, or an open sensor issue (sensor check first) |
| `none` | Nominal, or sensor artifact resolved |

## Earth link — `src/lib/comms`

- `delay.ts`: clamp to 3–22 min, round trip = 2 × one-way, light-travel distance = delay × c.
- `queue.ts`: one transmitter (30 s per message), urgent > priority > routine then FIFO, held while the link is down.
  Timeline per message: `sentAt` → `receivedAt = sentAt + delay` → `replySentAt = receivedAt + 120 s` →
  `replyReceivedAt = replySentAt + delay`. States: queued (awaiting send) · sent · received · response pending ·
  response received (simulated acknowledgement).

## Science & Limits — `src/lib/science`, `src/config/evidence-library.ts`, `src/data/osdr`

- `config/data-provenance.ts` classifies every kind of content as *simulated data*, *real scientific data & evidence* or *demonstration rules*.
- `config/evidence-library.ts` holds the verified NASA HRP evidence entries (`derivesThresholds: false`).
- `scripts/import-osdr.mjs` stores a public OSDR file verbatim (with SHA-256) in `src/data/osdr/`; `lib/science/osdr.ts` parses it and returns per-timepoint summaries only.
- Real data is read only by the Science & Limits components; the mission reducer, analysis engine and report never import it (tested).

## UI

`src/app/layout.tsx` mounts `MissionProvider` and `AppShell` (header, sidebar navigation, footer). Each route renders one
client view (`MonitorView`, `AnalysisView`, `ResponseView`, `CommsView`) and the static `ScienceView`. Next.js Cache
Components keeps recently visited routes mounted (React `<Activity>`), while the simulation keeps running in the provider.
All routes prerender as static content, which makes Vercel deployment configuration-free.
