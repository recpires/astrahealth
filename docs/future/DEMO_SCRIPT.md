# Demo script — FUTURE modules (≈ 4 minutes)

> 🇧🇷 [Versão em português](DEMO_SCRIPT.pt-BR.md) · 🖼 [Screenshots of every step](../screenshots/future/README.md) · Original three-scenario demo: [docs/DEMO_SCRIPT.md](../DEMO_SCRIPT.md)

**Story.** Mission day 15, four simulated crew members. Crew Member B has slept badly for five days, Crew Member C has a headache, an EVA is planned — and the link to Earth drops in the middle of it. Everything is simulated demonstration data.

## Before you present

1. Use Chrome or Edge, full screen, zoom 100 %. Open **Platform preview** (`/future`) once while online and wait until the bar shows **Available offline** — the whole app is then cached on the device.
2. Press **Reset demo data** → **Erase local records** so the story starts from the demo seed (day 15, 08:00).
3. Keep the tested demo at **Nominal** (do not start an incident: F03 reads its simulated vital signs).
4. If something goes wrong on stage: **Reset demo data** and start again; nothing is lost on the server because nothing is stored there.

## 0. Opening — Overview (20 s) · `/future` · [screenshot 1](../screenshots/future/01-overview.png)

> "The MVP you saw measures, understands, acts and communicates for one crew member in three tested scenarios. Here is where it goes next: an autonomous space health decision-support platform. Four principles: it works **offline**, it is **evidence-based**, a **human always decides**, and **everything is traceable**. The tested demo is untouched; these modules only read its simulated vital signs."

Point at the five cards, the mission-day clock and the Earth-link box.

## 1. F01 · Health Journal (40 s) · `/future/journal`

1. Click **Crew Member B** → [screenshot 2](../screenshots/future/02-journal-flags.png).
   > "Every morning each crew member fills a 30-second check-in. Versioned demonstration rules spot patterns: Crew Member B has slept under six hours five days in a row, with high fatigue. That is a flag for a human — not a diagnosis."
2. Click **Crew Member C**, type sleep **6.8**, fluid **1.3**, fatigue **3**, hydration **2**, tick **Headache**, **Save check-in** → [screenshot 3](../screenshots/future/03-journal-checkin.png).
   > "Saved on the device, with the mission time. The routines show what is overdue — Crew Member C's blood pressure is five days late."

## 2. F02 · Symptom Assessment (60 s) · `/future/assess`

1. **Crew Member C** · Headache · **Moderate** · **Gradually** · **Worse** · **20** h · duties **Yes** → **Run assessment** → [screenshot 4](../screenshots/future/04-assessment-headache.png).
   > "Operational advice comes only from a versioned rule set — ASTRA-SYM 0.1.0-demo — and you can see which rules matched. Then the evidence: the journal says headache on three of the last seven days, and the official NASA risks used as context. And the uncertainty is spelled out: high, because there is no symptom-specific NASA reference on board. It is never reported as low, because these rules are not clinically validated."
2. **Accept proposal** (human review).
3. **Crew Member B** · Dizziness · Moderate · Suddenly · **1** h · tick **Fainted or nearly fainted** → **Run assessment** → **Accept proposal** → **Queue report to Earth** → [screenshot 5](../screenshots/future/05-assessment-warning-sign.png).
   > "With a warning sign the rules ask for medical support now, an urgent report and an EVA hold. The cardiovascular risk is quoted word for word from the NASA evidence report we verified; references we have not reviewed are marked *reference only*. No language model: nothing here is generated."

## 3. F03 · Space Health Profile (25 s) · `/future/profile` · [screenshot 6](../screenshots/future/06-health-profile.png)

Click **Crew Member A**.
> "Nine domains, from neuro-ocular to sleep. Every number says when, where it came from, its quality, its trend and whether it is validated. And honesty matters most here: intracranial pressure, retina imaging, bone density need equipment we do not have — so the app says **No data** and the exam required. It never invents them."

## 4. F04 · EVA & Autonomous Response (60 s) · `/future/eva`

1. Untick Crew Member C, tick **Crew Member B**, **Plan EVA**; confirm **PRE-03 … PRE-06** → [screenshot 7](../screenshots/future/07-eva-gate-hold.png).
   > "The pre-EVA checklist uses the other modules: Crew Member B has no check-in today and is held by the urgent assessment. The system proposes **HOLD**. It is a procedural proposal, not a medical clearance — the commander decides."
2. Type a reason (e.g. *Ground-cleared training EVA*) → **Decide GO (override)**.
   > "Overriding is allowed, but only with a written reason — and it is logged."
3. Click **Earth link lost during EVA** → **Continue EVA** on that card. Untick **Suit biomedical telemetry**. Click **EVA crew member reports feeling unwell** → [screenshot 8](../screenshots/future/08-eva-event.png).
   > "No link, no telemetry. The protocol adapts: steps that need the missing equipment switch to their alternatives. An urgent report is created — it waits in the queue. The system proposes ending the EVA; the commander decides."
4. **End EVA** → **Queue EVA log to Earth**.

## 5. Earth Link — store and forward (30 s) · `/future`

1. Open **Overview** → [screenshot 9](../screenshots/future/09-link-lost-queue.png).
   > "Everything kept working without Earth. Three items wait; the urgent one is next to send even though it was created after the routine note."
2. **Restore link**, then **+15 min** → [screenshot 10](../screenshots/future/10-link-restored.png).
   > "Link back: urgent first, then routine. Twelve minutes later they are on Earth — the same 3-to-22-minute delay model as the tested Earth Link module."

## 6. F05 · Readiness & Trace (30 s) · `/future/readiness`

1. → [screenshot 11](../screenshots/future/11-readiness.png).
   > "For each crew member: is today's information complete and reviewed? This is data readiness, not fitness for duty. And the system checks itself: trail intact, rules versioned and provisional, every reference resolves offline."
2. Click **Tamper test (on a copy)**, scroll to the audit trail → [screenshot 12](../screenshots/future/12-audit-trail.png).
   > "Every decision, piece of evidence and transmission is in a checksum-chained trail, with the rule version and the inputs' checksum. Edit one entry and verification fails. It exports as JSON."

## 7. Closing — offline for real (15 s) · [screenshot 14](../screenshots/future/14-offline-reload.png)

Turn on airplane mode (or DevTools → Network → **Offline**) and press **F5**.
> "No network at all, full reload — the app and Crew Member C's check-in are still here. That is what a crew needs when Earth is twenty minutes away or silent."

Turn the network back on.

---

## Short version (90 s)

Overview (0) → Assessment with warning sign (2.3) → EVA override + event (4.2–4.3) → Restore link (5.2) → Tamper test (6.2).

## Likely questions

| Question | Answer |
|---|---|
| Is this a medical device? | No. It is a demonstration prototype; every rule and protocol is marked PROVISIONAL and was written by the team. It names no condition, medication or treatment. |
| Where do the rules come from? | From versioned JSON files in the repository (`src/data/future/`). Each decision records the rule set version and the rules that matched, so an expert can review and change them under version control. |
| What is the NASA content? | 15 official Human Research Roadmap risks (titles and links checked against the NASA index) and three NASA evidence reports quoted word for word. Which risk is shown for a symptom was chosen by the team. |
| Do you use AI to decide? | No. Decisions come from deterministic rules; AI tools were used to help build the software (see the AI disclosure). |
| What happens without Earth? | Everything runs locally; reports wait and leave in priority order when the link returns. The app even reloads with no network. |
| Is the data real? | No. All crew data are simulated or typed during the demo. |
