# ASTRA Health — FUTURE modules (platform preview)

> 🇧🇷 [Versão em português](README.pt-BR.md) · 🎬 [Demo script](DEMO_SCRIPT.md) · 🖼 [Screenshots](../screenshots/future/README.md) · 🧪 [Test report](TEST_REPORT.md) · ♿ [Accessibility](../ACCESSIBILITY.md)

The submitted MVP demonstrates **MEASURE → UNDERSTAND → ACT → COMMUNICATE** with three tested scenarios. The FUTURE modules show how ASTRA Health can grow into an **autonomous space health decision-support system** that is:

- **offline-first** — every module runs on local data and keeps its records on the device; reports to Earth wait in a queue;
- **evidence-based** — scientific context comes only from official NASA Human Research Program sources stored on board;
- **human-in-the-loop** — rules and protocols *propose*; the crew medical officer or the commander *decides*;
- **traceable** — every decision, piece of evidence shown and action is written to a checksum-chained audit trail.

Open it in the app from **Platform preview** in the menu (`/future`).

> ⚠️ **Demonstration content.** Every rule set, checklist and protocol below was written by Team ANGARIS for the prototype, is marked **PROVISIONAL**, is **not** a NASA procedure and is **not** clinically validated. All crew data are simulated (demo seed) or typed in during the demo. Nothing names a condition, a medication or a treatment.

---

## Boundaries with the tested demo

| | Tested demo (submission) | FUTURE modules |
|---|---|---|
| Routes | `/`, `/analysis`, `/response`, `/comms`, `/science` | `/future`, `/future/journal`, `/future/assess`, `/future/profile`, `/future/eva`, `/future/readiness` |
| State | `src/lib/mission` + `MissionProvider` (simulation clock in seconds) | `src/features/*` + `FutureProvider` (mission-day clock, own reducer) |
| Storage | none (in memory) | on-device `localStorage`, one versioned key per module |
| Link between them | — | FUTURE 03 **reads** the latest simulated vital signs of Crew Member A; nothing is ever written back |

The only change to the tested code is one extra menu entry ("Platform preview") and an optional `--out` folder for the scenario browser test. The 77 original tests and the 14 scenario browser checks are re-run on every change ([regression section of the report](TEST_REPORT.md#regression-of-the-tested-demo)).

The frozen submission version is commit `4381231` (local tag `v1.0.0-spaceapps`).

---

## Architecture

```
src/features/
├── platform/            shared core
│   ├── types.ts         MissionTime, AuditEntry, OutboxItem, ModuleResult
│   ├── time.ts          mission-day clock (day + minute)
│   ├── checksum.ts      deterministic 64-bit checksum, stable JSON
│   ├── audit.ts         append-only, checksum-chained audit trail + verification
│   ├── earth-link.ts    store-and-forward outbox: priority order, delay, acknowledgement
│   ├── references.ts    NASA HRR risk references (verified-excerpts / reference-only)
│   ├── store.ts         one pure reducer: routes actions to modules, appends audit + outbox, syncs the link
│   ├── storage.ts       versioned on-device persistence with validation and seed fallback
│   └── FutureProvider.tsx
├── journal/   F01       config (crew, symptoms, routines, rules) · logic (routines, flags, trends) · reducer
├── assess/    F02       engine (rule matching, evidence, uncertainty) · reducer (review, report)
├── profile/   F03       config (9 domains, 28 metrics) · logic (profile builder, entries)
├── eva/       F04       logic (checklists, gate proposal, alternatives) · reducer (plan → gate → events → close)
└── readiness/ F05       crew readiness · system verification · rule-set registry

src/data/future/
├── journal-demo.json, profile-demo.json   demo seed (npm run generate:future)
├── symptom-ruleset.json                    ASTRA-SYM@0.1.0-demo
├── eva-protocol.json                       ASTRA-EVA@0.1.0-demo
├── hrr-risk-references.json                15 official NASA HRR risks (title + link)
├── hrr-risk-index.snapshot.json            snapshot of the official index, for offline tests
└── verification-matrix.json                completion criteria → how they are verified
```

Every module reducer is pure and returns `{ state, audit[], outbox[] }`. The platform store stamps each audit entry with the mission time and the previous entry's checksum, turns outbox drafts into queued items, and then synchronises the queue with the simulated Earth link (3–22 min one-way, the same range as the tested Earth Link module).

---

## F01 · Health Journal & Daily Check (`/future/journal`)

- Daily check-in per crew member: sleep hours, sleep quality, mood, fatigue, felt hydration (1–5 scales with their meaning shown), optional fluid intake, self-reported symptoms, notes. One check-in per day (a new one replaces today's).
- Routines (demonstration schedule): daily check-in, body mass and blood pressure every 7 days, visual acuity self-check every 14 days — overdue / due today / upcoming / done today. A routine completion only records that the task was done; values go to F03.
- 14-day trends per metric with visible gaps on missing days; full history; crew overview.
- Attention flags from **ASTRA-JOURNAL@0.1.0-demo**: short sleep (< 6 h, 3 days), high fatigue (≥ 4, 3 days), low mood (≤ 2, 3 days), low felt hydration (≤ 2, 2 days), symptom reported (last 2 days), missing check-in (last 3 days). Streaks count only if they end today or yesterday. Flags suggest a human follow-up; they are not a diagnosis.
- A journal summary can be queued to Earth (routine priority).

## F02 · Symptom Assessment & Evidence Engine (`/future/assess`)

- Structured questions: main symptom, crew member's own severity rating, onset, trend, duration, ability to do duties, warning signs present now (demonstration list used only to suggest immediate contact with medical support).
- **Operational output only from the versioned rule set** `ASTRA-SYM@0.1.0-demo` (`src/data/future/symptom-ruleset.json`): attention level (Monitor → Inform crew medical officer → Medical support recommended → Medical support now), ordered next steps, report priority. Rules are declarative JSON so they can be reviewed, diffed and versioned.
- **Evidence**: facts from the journal (how often the symptom was reported, today's check-in) and official NASA HRR risks associated with the symptom. *Verified excerpts* are quoted word for word from the evidence library of Science & Limits; *reference-only* entries show only the official title and link.
- **Uncertainty is always stated** (missing answers, no check-in today, no symptom-specific reference, reference-only evidence) and is never reported as "low", because the rules are not validated.
- **Human in the loop**: the crew medical officer accepts or overrides the proposal (override requires a note). The report to Earth is queued by a person.
- Each run records the matched rule ids, evidence ids and a checksum of the inputs.
- No language model is used. A future explanation layer could summarise science, but it would never change the proposed steps.

## F03 · Extended Health Metrics — Space Health Profile (`/future/profile`)

Nine domains — neuro-ocular, cardiovascular, renal, radiation, bone, vascular, immunological, emotional & behavioral, sleep — 28 metrics. Each metric shows **value, unit, time, origin, quality, trend and validation status**, or says plainly that there is no data.

| Method | Source | Validation shown |
|---|---|---|
| self-report | F01 journal | self-reported (subjective) |
| sim-telemetry | latest value of the tested Monitoring simulation (Crew Member A only) | simulated |
| crew-device | typed in by the crew from an onboard device (typing range check only) | crew-entered (not validated) / demo seed (simulated) |
| unavailable | needs an exam or equipment not available in the demo | **no data** + required exam + last result "none recorded" |

ASTRA Health **never simulates or estimates** intracranial pressure, retina/optic-nerve imaging, bone mineral density, kidney imaging, urine analysis, jugular vein flow, ECG, blood count, biological dosimetry, validated behavioral questionnaires or actigraphy. Equipment availability is a demonstration assumption, not a statement about any real vehicle. Each domain links to its official NASA HRR risk (association chosen by the team).

## F04 · EVA & Autonomous Response (`/future/eva`)

- Protocol **ASTRA-EVA@0.1.0-demo**: pre-, during- and post-EVA checklists, four in-EVA events (crew member feeling unwell, suit telemetry lost, voice loop lost, Earth link lost).
- **Equipment-conditioned steps**: when suit telemetry, voice loop, pulse oximeter or suit pressure readout is marked unavailable, dependent steps switch to their alternative text, and the switch is logged.
- **Pre-EVA gate**: automatic checks use other modules — every EVA crew member checked in today (F01), no assessment holding EVA participation (F02), Earth link status noted. The system proposes GO / HOLD (a procedural proposal, not a medical clearance); the commander decides; deciding against the proposal requires a reason.
- **Events**: the protocol is applied, a report is queued with the event's priority (urgent / priority / routine), the system proposes continue or end the EVA, and the commander decides (override needs a reason). "Earth link lost" switches the platform link off; everything keeps working and syncs later.
- Decision history of every gate and event decision; EVA log queued to Earth; closing with open post-EVA items requires a reason.

## F05 · Verification & Mission Readiness (`/future/readiness`)

- **Crew data & procedure readiness** per crew member: today's check-in, overdue routines, journal flags, assessments awaiting review or suggesting support, profile coverage (and how many metrics need unavailable equipment), EVA holds. Explicitly *not* a medical clearance or fitness-for-duty decision.
- **System verification**: audit-trail integrity, versioned rule sets with checksums, nothing presented as validated, every evidence / step reference resolves offline, proposals waiting for a human, offline queue status, on-device storage.
- **Traceability**: filterable audit trail (module, kind, rule set, rule ids, evidence ids, record id, input checksum, entry checksum), a tamper test on a copy, and JSON export of the whole trace.
- The completion criteria and how they are verified (`verification-matrix.json`).

---

## Earth Link (store-and-forward)

### Offline reload (service worker)

`public/sw.js` is registered in production builds. On installation it stores every page of the app (tested demo included) and the files they use. Pages and data always come from the network first, so online behaviour is unchanged; when the network fails, the stored copy is used. After one online visit, the app reloads and navigates with **no network and no server** — `E2E-OFF-05` stops the web server, takes the browser offline, reloads all 11 pages (with every image) and runs a new assessment. The platform bar shows **Available offline** once the worker controls the page. Bump `SW_VERSION` in `public/sw.js` to force every device to re-cache.

### Store-and-forward queue

Items are always created locally. While the link is lost they wait. When it is available they leave in priority order — **urgent → priority → routine**, then oldest first — reach Earth after the one-way delay and are acknowledged after the round trip (the acknowledgement needs the link). Every transition is in the audit trail. Use **Simulate link loss / Restore link** and **+15 min / +1 h / Next day** in the platform bar.

## Scientific references

15 official NASA Human Research Roadmap risks (`src/data/future/hrr-risk-references.json`), titles and links checked against the official risk index on 2026-11-15:

```bash
NODE_USE_ENV_PROXY=1 npm run future:check-refs      # live check against humanresearchroadmap.nasa.gov
npm run future:check-refs -- --write-snapshot        # refresh the offline snapshot used by the tests
```

Three of them (cardiovascular, hypoxia, in-mission medical conditions) are covered by the verified evidence reports of the Science & Limits library and are shown with verbatim quotes. The others are reference-only. Which risk is shown for a symptom, domain or EVA protocol was chosen by Team ANGARIS; it is not a NASA statement.

## Tests

```bash
npm run test:future            # 110 unit, integration and interface tests (tests/future)
npm run build
npm run test:e2e:future        # 19 browser checks: F01–F05, network cut, reload, export, phone/tablet layout,
                               #   full reload with the server stopped
npm run test:a11y              # accessibility audit → docs/ACCESSIBILITY.md
npm run screenshots:future     # the 14 screenshots of the demo script
npm run test:regression        # the original 77 tests
npm run test:e2e:regression    # the 14 browser checks of the three scenarios
npm run test:report:future     # writes docs/future/TEST_REPORT(.pt-BR).md
```

See the [test report](TEST_REPORT.md) for results, screenshots and the status of each completion criterion.

## Limits and next steps

- Rules, intervals, checklists, equipment assumptions: demonstration values that need expert review.
- Offline: the app needs one online visit before it can reload without network; a flight system would also run an onboard server so several devices share the same records (today each device keeps its own).
- The audit checksum detects casual edits; a flight system would sign entries and replicate them to the ground.
- Next: multi-user roles (CMO, commander), expert-reviewed rule sets with change control, bilingual interface, real device adapters, ground-side console.
