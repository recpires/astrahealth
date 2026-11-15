# Demo script (≈ 4 minutes)

Tip: keep the speed at **10×** while talking; use **60×** to fast-forward Earth-link messages; **pause** (‖) any time.

## 0. Opening (15 s)

"ASTRA Health helps an astronaut on a long-duration mission go from **MEASURE** to **UNDERSTAND** to **ACT** to
**COMMUNICATE** — even when Earth is minutes away. Everything you see is simulated demonstration data."

Point at the *SIMULATED DATA · DEMO* tag and the mission clock.

## 1. Scenario 1 — Nominal monitoring (30 s) · `/`

- Three vital signs, trend charts with the provisional demo band, signal quality and sensor status: all green.
- System assessment: **NOMINAL**, reliability **High**. Response page: routine monitoring only, no medical support.

## 2. Scenario 2 — Vital-sign deviation (90 s)

1. **Monitoring**: press **Simulate incident**. Within ~10–15 s heart rate climbs, SpO₂ drops, temperature rises; the
   level goes CAUTION → **WARNING**.
2. **Analysis**: three findings explained in plain language with evidence; reliability **High** because the sensors are
   good and the signals corroborate each other; event history shows detections and escalations. "This is an attention
   level, not a diagnosis."
3. **Response**: *Request medical support now* — CMO on board, flight surgeon on Earth with a 12-min one-way delay.
   Tick two checklist steps; they appear time-stamped in the action log.
4. **Earth Link**: **Generate report** (show TEXT and JSON), priority is pre-set to **Urgent**, **Queue for
   transmission**. Switch to 60× and watch *Awaiting send → Sent → Received → Response pending → Response received*.
   Change the delay (3 / 12 / 22 min) to show the round-trip estimate; try **Simulate outage** to hold the queue.

## 3. Scenario 3 — Sensor fault (60 s)

1. **Monitoring**: press **Simulate sensor fault**. SpO₂ becomes erratic and very low, but heart rate and temperature
   stay steady; the oximeter shows poor signal and dropouts.
2. **Analysis**: violet **sensor-issue** findings, *reading inconsistent — confirmation needed*, reliability **Low**.
   "The system refuses to treat a broken sensor as a medical emergency."
3. **Response**: *Keep monitoring — medical support not yet required*. Press **Take confirmation reading** → 98 % →
   *Not reproduced — sensor artifact*. SpO₂ is excluded, level drops to **ADVISORY**, the sensor-replacement checklist
   appears. (Alternative: *Unable to re-measure* → medical support recommended.)
4. **Monitoring**: the SpO₂ value is struck through and marked *Excluded — sensor artifact*.

## 4. Closing (20 s) · `/science`

"Thresholds are provisional; the NASA scientific resource slot is ready and stays empty until the team confirms the
official challenge statement. No diagnosis, no treatment advice, and AI assistance is disclosed."
