# ASTRA Health — relatório de testes dos módulos FUTURE

> Gerado por `scripts/build-future-report.mjs` a partir dos arquivos de resultado brutos. Versão do código: `c87e603`. Execuções no navegador: Chromium 153.0.8010.12, 2026-11-15.

Todos os dados de tripulação destes testes são simulados ou digitados pelo próprio teste. Regras e protocolos são conteúdo demonstrativo (PROVISIONAL) — testes aprovados mostram que o software se comporta como especificado, não que alguma regra seja clinicamente válida.

## Resumo

| Suíte | Comando | Aprovados |
|---|---|---|
| Testes FUTURE unitários, de integração e de interface | `npm run test:future` | **110/110** |
| Verificações FUTURE ponta a ponta no navegador (incl. offline + recarga) | `npm run test:e2e:future` | **19/19** |
| Regressão — 77 testes originais | `npm run test:regression` | **77/77** |
| Regressão — 14 verificações no navegador dos três cenários | `npm run test:e2e:regression` | **14/14** |

Erros de página no navegador: 0 · Resultado geral: **TUDO APROVADO**

## Critérios de conclusão

| ID | Critério | Como é verificado | Situação |
|---|---|---|---|
| C1 | Os 77 testes existentes continuam passando. | npm test executa as suítes originais sem alteração (tests/acceptance, tests/*.test.ts, tests/ui/*) junto com as novas suítes tests/future. | ✅ Atendido |
| C2 | Os três cenários originais continuam funcionando. | tests/acceptance/scenarios.acceptance.test.ts (17 casos) e a execução no navegador scripts/e2e-scenarios.cjs (14 verificações) contra o build de produção. | ✅ Atendido |
| C3 | Cada módulo novo tem testes unitários, de integração e ponta a ponta. | Unitários: tests/future/{platform,journal,assess,profile,eva,readiness,references}.test.ts · Integração: tests/future/integration.test.ts · Interface: tests/future/ui.test.tsx · Ponta a ponta no navegador: scripts/e2e-future.cjs (F01–F05). | ✅ Atendido |
| C4 | Nenhuma orientação clínica é apresentada como validada. | Todo conjunto de regras e protocolo é PROVISIONAL (verificação V-NOT-VALIDATED); os testes rejeitam termos de diagnóstico, medicamento e tratamento em todas as regras e protocolos. | ✅ Atendido |
| C5 | O sistema funciona com fontes locais durante a perda de comunicação. | Testes de integração executam todos os módulos com o link com a Terra perdido e verificam a sincronização por prioridade ao restabelecer; no navegador a rede é cortada e o app continua funcionando, e um service worker permite recarregar as 11 páginas com o servidor web desligado e o navegador offline (E2E-OFF-05). | ✅ Atendido |
| C6 | Toda decisão, evidência e ação é rastreável. | Cada registro entra numa trilha de auditoria encadeada por checksum, com versão do conjunto de regras / protocolo, regras acionadas, ids de evidência e checksum das entradas; os testes verificam a cadeia e detectam adulteração; a trilha pode ser exportada em JSON. | ✅ Atendido |

## Testes automatizados por arquivo

| Arquivo | Cobre | Tipo | Aprovados |
|---|---|---|---|
| `tests/future/assess.test.ts` | F02 Avaliação de sintomas | unitário | 17/17 |
| `tests/future/eva.test.ts` | F04 EVA e resposta | unitário | 14/14 |
| `tests/future/integration.test.ts` | Integração entre módulos | integração | 5/5 |
| `tests/future/journal.test.ts` | F01 Diário de saúde | unitário | 16/16 |
| `tests/future/offline.test.ts` | tests/future/offline.test.ts | — | 3/3 |
| `tests/future/platform.test.ts` | Núcleo da plataforma | unitário | 18/18 |
| `tests/future/profile.test.ts` | F03 Perfil de saúde espacial | unitário | 11/11 |
| `tests/future/readiness.test.ts` | F05 Prontidão | unitário | 10/10 |
| `tests/future/references.test.ts` | Referências NASA HRR | unitário | 3/3 |
| `tests/future/ui.test.tsx` | Interface (F01–F05) | interface | 13/13 |
| **Total** | | | **110/110** |

<details><summary>Nome de cada teste FUTURE (110)</summary>

**tests/future/assess.test.ts**

- ✅ versioned rule set › is identified, versioned and marked PROVISIONAL
- ✅ versioned rule set › references only steps and NASA references that exist
- ✅ versioned rule set › never names a condition, a medication or a treatment in what it shows or proposes
- ✅ rule matching › always matches the baseline rule
- ✅ rule matching › matches each rule on its own condition
- ✅ rule matching › uses the journal: a symptom reported on 3+ of the last 7 days matches SYM-R08
- ✅ assessment output › takes the highest level of the matched rules and lists its steps first, each once
- ✅ assessment output › asks for medical support now when a warning sign is present
- ✅ assessment output › keeps a mild, stable symptom at monitor level without a report priority
- ✅ assessment output › shows verified excerpts word for word, and reference-only entries without content
- ✅ assessment output › states uncertainty and never reports it as low
- ✅ assessment output › is deterministic: same inputs → same output and checksum
- ✅ assessment output › validates input
- ✅ assessment reducer — human in the loop and traceability › records the decision with rule ids, evidence ids and input checksum
- ✅ assessment reducer — human in the loop and traceability › requires a note to override, and accepts only one review
- ✅ assessment reducer — human in the loop and traceability › queues a report once, with the priority suggested by the level
- ✅ assessment reducer — human in the loop and traceability › holds EVA participation for two mission days when NO-EVA is proposed

**tests/future/eva.test.ts**

- ✅ demonstration protocol › is versioned, PROVISIONAL and not presented as a NASA procedure
- ✅ demonstration protocol › has an alternative for every equipment-dependent step and no medication or treatment
- ✅ demonstration protocol › switches a step to its alternative when the equipment is unavailable
- ✅ pre-EVA gate (system proposes, commander decides) › plans an EVA for exactly two crew members
- ✅ pre-EVA gate (system proposes, commander decides) › proposes HOLD until every pre-EVA item is satisfied, then GO
- ✅ pre-EVA gate (system proposes, commander decides) › uses FUTURE 01 and FUTURE 02 data in its automatic checks
- ✅ pre-EVA gate (system proposes, commander decides) › requires a reason to decide against the proposal and logs the override
- ✅ pre-EVA gate (system proposes, commander decides) › accepts a HOLD that matches the proposal without a reason and stays in pre-EVA
- ✅ during the EVA › applies the event protocol, queues a prioritised report and waits for the commander
- ✅ during the EVA › marks equipment lost by an event and uses alternatives from then on
- ✅ during the EVA › asks the platform to mark the Earth link lost on EV-LINK-LOST
- ✅ during the EVA › ends the EVA when the commander follows a terminate proposal; override needs a reason
- ✅ post-EVA and closure › queues the EVA log, then closes only with all items done or a reason
- ✅ post-EVA and closure › rejects checklist items from another phase

**tests/future/integration.test.ts**

- ✅ end-to-end flow across modules (domain level) › journal symptom → assessment hold → EVA HOLD proposal → override with reason → full trace
- ✅ communication loss (offline operation) › every module keeps working while the Earth link is lost, and reports sync in priority order afterwards
- ✅ communication loss (offline operation) › an EVA event 'Earth link lost' switches the platform link off and is traced
- ✅ persistence across a reload › restores every module, the trail and the queue exactly
- ✅ isolation from the tested three-scenario demo › FUTURE actions never touch the mission simulation state

**tests/future/journal.test.ts**

- ✅ demo seed › is labelled simulated and covers days 1–14 for four crew members
- ✅ routine schedule › derives overdue / due-today / done-today from completions
- ✅ routine schedule › marks a routine done today after completion
- ✅ routine schedule › never allows the daily check-in to be ticked as a routine
- ✅ routine schedule › uses demonstration intervals (not a NASA schedule)
- ✅ attention flags (demonstration rules) › raises the storyline flags of the seed
- ✅ attention flags (demonstration rules) › reports the days that triggered each flag
- ✅ attention flags (demonstration rules) › needs the full streak: two short nights are not enough
- ✅ attention flags (demonstration rules) › only looks at recent streaks
- ✅ attention flags (demonstration rules) › words flags as follow-ups, never as a diagnosis or treatment
- ✅ check-in reducer › records a crew check-in with time and source, and replaces the same-day entry
- ✅ check-in reducer › logs a decision with the rule set version when a check-in raises a new flag
- ✅ check-in reducer › rejects out-of-range input without changing anything
- ✅ check-in reducer › queues a routine journal summary for Earth
- ✅ trends › builds a 14-day series with gaps on missing days
- ✅ trends › keeps only the latest check-in of a day

**tests/future/offline.test.ts**

- ✅ offline service worker › pre-caches exactly the routes of the app
- ✅ offline service worker › tries the network first for pages and data, so online behaviour is unchanged
- ✅ offline service worker › is served with no-cache headers

**tests/future/platform.test.ts**

- ✅ mission clock › converts between mission time and absolute minutes
- ✅ checksum › is deterministic and independent of key order
- ✅ audit trail › chains every entry to the previous one
- ✅ audit trail › detects an edited, removed or reordered entry
- ✅ Earth outbox (store-and-forward) › orders transmission by priority, then age
- ✅ Earth outbox (store-and-forward) › keeps everything queued while the link is lost
- ✅ Earth outbox (store-and-forward) › sends in priority order, delivers after the one-way delay and is acknowledged after the round trip
- ✅ Earth outbox (store-and-forward) › waits for the link to return before an acknowledgement can be received
- ✅ platform store › starts on mission day 15 with the demo seed and one audit entry
- ✅ platform store › advances time and moves to the next mission day at 08:00
- ✅ platform store › logs link changes and clamps the delay to 3–22 min
- ✅ platform store › ignores unknown or invalid actions without touching the trail
- ✅ on-device storage › returns the seed when nothing is stored
- ✅ on-device storage › round-trips the whole state through storage
- ✅ on-device storage › only rewrites modules that changed
- ✅ on-device storage › replaces a corrupted module with the seed and says so
- ✅ on-device storage › resets everything when the platform slice is invalid
- ✅ on-device storage › records the restoration notes in the audit trail on hydrate

**tests/future/profile.test.ts**

- ✅ Space Health Profile structure › has exactly the nine requested domains, each with an official NASA risk reference
- ✅ Space Health Profile structure › gives every metric value, unit, time, origin, quality, trend and validation status
- ✅ no simulation without equipment › never produces a value for intracranial pressure, bone density, kidney imaging and the other unavailable exams
- ✅ no simulation without equipment › refuses typed values for unavailable or derived metrics
- ✅ no simulation without equipment › does not ship any seed value for an unavailable metric
- ✅ metric sources › derives self-report metrics from the FUTURE 01 journal
- ✅ metric sources › reads simulated telemetry for Crew Member A only, flagging a suspect sensor
- ✅ metric sources › labels demo-seed device readings as simulated and marks them stale after their window
- ✅ metric sources › stores a crew-entered reading as not validated and logs it
- ✅ metric sources › checks typed values against a typing range only
- ✅ trend › needs three points and uses a tolerance

**tests/future/readiness.test.ts**

- ✅ crew data & procedure readiness › is incomplete for everyone at 08:00 on day 15 (no check-in yet)
- ✅ crew data & procedure readiness › lists what needs attention per module
- ✅ crew data & procedure readiness › flags unreviewed assessments and EVA holds
- ✅ crew data & procedure readiness › counts profile coverage and never counts unavailable exams as data
- ✅ crew data & procedure readiness › is labelled as not being a medical clearance (in the UI) — the logic returns data status only
- ✅ system verification › passes on the demo state
- ✅ system verification › detects a tampered audit trail
- ✅ system verification › reports proposals still waiting for a human decision
- ✅ system verification › lists four versioned, PROVISIONAL rule sets with checksums
- ✅ system verification › reports blocked storage

**tests/future/references.test.ts**

- ✅ HRR risk references › match the official index title-for-title
- ✅ HRR risk references › are unique and say that the association is the team's, not NASA's
- ✅ HRR risk references › link to the verified evidence library only where that library covers the same HRR risk page

**tests/future/ui.test.tsx**

- ✅ F01 · Health Journal › shows the seed flags of Crew Member B and the overdue routines of Crew Member D
- ✅ F01 · Health Journal › validates and saves a check-in, then lists it as a crew entry
- ✅ F01 · Health Journal › marks a routine done
- ✅ F02 · Symptom Assessment › runs the rules and shows steps, evidence, uncertainty and the human review
- ✅ F02 · Symptom Assessment › moves to 'Medical support now' when a warning sign is ticked
- ✅ F03 · Space Health Profile › shows nine domains and 'No data' for exams that need unavailable equipment
- ✅ F03 · Space Health Profile › records a typed reading as not validated and rejects out-of-range typing
- ✅ F04 · EVA & Autonomous Response › plans an EVA, proposes HOLD, requires a reason to override, and handles an event
- ✅ F05 · Readiness & Trace › shows crew readiness, passing system checks and a working tamper test
- ✅ platform bar, overview and offline persistence › advances time, loses and restores the Earth link, and sends queued items
- ✅ platform bar, overview and offline persistence › saves to the device and restores after a remount (reload)
- ✅ platform bar, overview and offline persistence › restores demo data when stored data is corrupted, and says so in the trail
- ✅ platform bar, overview and offline persistence › overview lists the five modules

</details>

## Verificações ponta a ponta no navegador (build de produção)

Executado com `next start`, Chromium 153.0.8010.12, janela 1440×900, 31 s. As descrições ficam em inglês, como no código dos testes.

| ID | Módulo | Verificação | Esperado | Observado | Resultado |
|---|---|---|---|---|---|
| E2E-F01-01 | F01 | Demo journal: storyline flags appear for Crew Member B and D | B: SHORT_SLEEP + HIGH_FATIGUE (days 10–14); D: CHECKIN_MISSING (days 12, 14); D body mass overdue | B: short sleep + high fatigue · D: "Missing check-in CHECKIN_MISSING No check-in recorded for Crew Member …" · D body mass: overdue [📷](../test-results/future/e2e/E2E-F01-01.png) | ✅ |
| E2E-F01-02 | F01 | Crew Member A records today's check-in | Saved with mission time and stored on the device; listed as a crew entry | "Saved for Crew Member A · Day 15 · 08:00 · stored on this device" · history: D 15 08:00 7.4 h 3 /5 4 /5 2 /5 3 /5 — Crew entry [📷](../test-results/future/e2e/E2E-F01-02.png) | ✅ |
| E2E-F01-03 | F01 | A routine is marked done | Body mass (Crew Member D) changes from Overdue to Done today | Body mass measurement Every 7 days · last day 15 · next due day 22 Done today Equipment: Body mass measurement device | ✅ |
| E2E-F02-01 | F02 | Moderate, worsening headache for Crew Member C | Inform crew medical officer; uncertainty HIGH (no symptom-specific NASA reference); rules ASTRA-SYM@0.1.0-demo | level "Inform crew medical officer" · uncertainty HIGH · reviewed: accepted | ✅ |
| E2E-F02-02 | F02 | Dizziness with a warning sign for Crew Member B | Medical support now; URGENT report and EVA hold proposed; verified NASA excerpt quoted; report queued as urgent | level "Medical support now" · steps include URGENT report + EVA hold · evidence: verified excerpt + reference-only · queued (urgent) [📷](../test-results/future/e2e/E2E-F02-02.png) | ✅ |
| E2E-F03-01 | F03 | Nine domains; unavailable exams show 'No data' and are never simulated | 9 domain panels; intracranial pressure, bone density, kidney imaging = No data; heart rate from simulated telemetry for Crew Member A only | 9 domains · ICP / bone density / kidney imaging: No data · HR Crew A 71 bpm (simulated) · Crew B: No data [📷](../test-results/future/e2e/E2E-F03-01.png) | ✅ |
| E2E-F03-02 | F03 | Typed blood-pressure reading | 400 rejected by the typing check (not a clinical limit); 118 stored as crew-entered (not validated) | 400 → "Value must be between 60 and 250 mmHg (typing check, not a clinical limit)." · 118 → 118 mmHg, crew-entered (not validated) | ✅ |
| E2E-F04-01 | F04 | Pre-EVA gate for Crew Members A and B | System proposes HOLD: Crew B has no check-in today and is held by the urgent assessment; GO is disabled without a reason | proposal HOLD · PRE-01 "check: No check-in today: Crew Member B." · PRE-02 held · GO disabled [📷](../test-results/future/e2e/E2E-F04-01.png) | ✅ |
| E2E-F04-02 | F04 | Override, equipment loss and an in-EVA event | Override GO logged with reason; telemetry unavailable → alternative steps; 'feeling unwell' → urgent report queued; commander ends the EVA | GO override logged · DUR-02 + U3 use alternatives · urgent report queued · EVA ended by commander [📷](../test-results/future/e2e/E2E-F04-02.png) | ✅ |
| E2E-F04-03 | F04 | Post-EVA closure | EVA log queued (routine); closing with open items requires a reason; EVA moves to history | closed; decision history: Time Decision point Proposal Decision By Day 15 · 08:00 EVA-0007 pre-EVA gate HOLD GO override “ Ground-reviewed exercis… | ✅ |
| E2E-OFF-01 | Platform | Earth link lost and the browser cut from the network: modules keep working on local data | Check-in, assessment and report work offline; items wait in the queue (Waiting to send) | check-in saved offline for Crew Member D · 4 item(s) in queue · browser offline: true [📷](../test-results/future/e2e/E2E-OFF-01.png) | ✅ |
| E2E-OFF-02 | Platform | Moving between FUTURE modules while offline | Client-side navigation to F05 works without the network; records are visible | F05 rendered offline · V-OFFLINE Works without the Earth link PASS Link LOST · 1 item(s) waiting to be sent · all FUTURE data and ref [📷](../test-results/future/e2e/E2E-OFF-02.png) | ✅ |
| E2E-OFF-03 | Platform | Earth link restored | Queued items are sent in priority order (urgent first) and acknowledged after the round trip | 4 items · first sent: urgent · after +1 h: 0 pending (all acknowledged) [📷](../test-results/future/e2e/E2E-OFF-03.png) | ✅ |
| E2E-OFF-04 | Platform | Reload the page: records come back from the device | Crew Member D's offline check-in, the queue history and the audit trail are restored after reload | clock Day 15 · 09:00 restored · "Saved for Crew Member D · Day 15 · 08:00 · stored on this device" [📷](../test-results/future/e2e/E2E-OFF-04.png) | ✅ |
| E2E-F05-01 | F05 | Readiness, verification and tamper test | 4 crew cards; audit trail intact; no rule set presented as validated; tamper test detects an edited copy | 4 crew cards · V-AUDIT PASS · V-NOT-VALIDATED PASS · 43 audit entries · tamper: "Edited a copy of entry #22 → verification failed at entry #22: entry content changed after…" [📷](../test-results/future/e2e/E2E-F05-01.png) | ✅ |
| E2E-F05-02 | F05 | Export of the full trace | Downloaded JSON contains the state, the rule-set versions and a verified checksum chain | astra-health-trace-day15.json · 43 entries, chain ok · kinds: action, data, decision, evidence, sync, system · rule sets: ASTRA-JOURNAL@0.1.0-demo, ASTRA-SYM@0.1.0-demo, ASTRA-PROFILE@0.1.0-demo, ASTRA-EVA@0.1.0-demo [📷](../test-results/future/e2e/E2E-F05-02.png) | ✅ |
| E2E-REG-01 | Regression | The tested demo is unchanged and reachable | Monitoring still shows the three vital cards and scenario buttons; 'Platform preview' is an extra menu entry | vital cards + scenario buttons present · nav: Monitoring, Analysis, Response, Earth Link, Science & Limits, Platform preview [📷](../test-results/future/e2e/E2E-REG-01.png) | ✅ |
| E2E-RESP-01 | Platform | Responsive layout of every FUTURE page | No horizontal page scroll at phone (390 px) and tablet (820 px) widths; wide tables scroll inside their own panel | 6 pages × 2 widths: no horizontal page scroll | ✅ |
| E2E-OFF-05 | Platform | Full reload with no server and no network | After the service worker has cached the app, the server is stopped and the browser goes offline: all 11 pages reload, saved records are there, navigation and a new assessment still work | server stopped + browser offline · 11/11 pages reloaded with every image · "Saved for Crew Member D · Day 15 · 08:00 · stored on this device" · new assessment: Monitor · menu navigation to Earth Link OK [📷](../test-results/future/e2e/E2E-OFF-05.png) | ✅ |

Com o navegador offline (E2E-OFF-01), a página tentou **0** requisição(ões) de rede: todas as ações FUTURE rodaram com dados locais.

## Regressão da demonstração testada

| Arquivo | Aprovados |
|---|---|
| `tests/analysis.test.ts` | 18/18 |
| `tests/comms.test.ts` | 8/8 |
| `tests/evidence.test.ts` | 5/5 |
| `tests/osdr.test.ts` | 9/9 |
| `tests/science.test.ts` | 5/5 |
| `tests/acceptance/scenarios.acceptance.test.ts` | 17/17 |
| `tests/ui/modules.test.tsx` | 10/10 |
| `tests/ui/science.test.tsx` | 5/5 |
| **Total** | **77/77** |

| ID | Verificação do cenário | Resultado |
|---|---|---|
| E2E-S1-01 | Monitoring shows three simulated vital signs within range, sensors online, level NOMINAL | ✅ |
| E2E-S1-02 | Analysis shows NOMINAL, no findings and High reliability | ✅ |
| E2E-S1-03 | Response shows no medical support and routine monitoring only | ✅ |
| E2E-S1-04 | Routine report is queued and passes through every message state | ✅ |
| E2E-S2-01 | 'Simulate incident' leads to WARNING with HR above and SpO₂ below the demo range | ✅ |
| E2E-S2-02 | Analysis lists three vital-sign deviations, reliability High and escalation events | ✅ |
| E2E-S2-03 | Response requests medical support now and logs a completed checklist step | ✅ |
| E2E-S2-04 | Urgent incident report is generated and delivered through every state | ✅ |
| E2E-S3-01 | 'Simulate sensor fault' gives CAUTION with SpO₂ unverified and other sensors online | ✅ |
| E2E-S3-02 | Analysis reports an inconsistent reading (sensor issue), no vital deviation, reliability Low | ✅ |
| E2E-S3-03 | Response asks to confirm the SpO₂ measurement; medical support not yet required | ✅ |
| E2E-S3-04 | Confirmation reading attributes the values to the sensor; SpO₂ excluded; ADVISORY | ✅ |
| E2E-S3-06 | Informational report contains the crew confirmation and resolved findings | ✅ |
| E2E-S3-05 | If the crew cannot re-measure, medical support is recommended | ✅ |

O relatório congelado da submissão dos três cenários continua em [docs/TEST_REPORT.pt-BR.md](../TEST_REPORT.pt-BR.md); esta regressão repete as mesmas verificações no código atual e grava os resultados em `docs/test-results/future/regression/`.

## Limites destes testes

- Verificam o comportamento do software em relação à especificação, não validade clínica. Todo limite, regra e checklist é um valor demonstrativo.
- A recarga offline é testada depois de uma visita com internet (o service worker precisa ter guardado o app antes): o servidor web é desligado e o navegador fica offline (E2E-OFF-05). Os registros ficam em cada dispositivo; compartilhá-los entre dispositivos exigiria um servidor de bordo.
- O checksum da trilha de auditoria detecta edições acidentais ou casuais; não é uma assinatura criptográfica.
- As referências NASA HRR são conferidas título a título com o índice oficial (snapshot em `src/data/future/hrr-risk-index.snapshot.json`; atualize com `npm run future:check-refs`).
