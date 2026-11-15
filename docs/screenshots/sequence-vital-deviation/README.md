# Scenario 2 — complete capture sequence (simulated vital-sign deviation)

16:9 frames (2880 × 1620 px, 1920 × 1080 layout at 1.5×) captured by `npm run screenshots:sequence`
(`scripts/capture-vital-sequence.cjs`). The simulation is paused at each step. **All data is simulated demonstration data.**

| # | Module | Frame |
|---|--------|-------|
| 01 | MEASURE | Baseline — nominal monitoring before the incident |
| 02 | MEASURE | "Simulate incident" pressed — scenario 2 running, values still normal |
| 03 | MEASURE | First deviation detected — SpO₂ below demo range, level CAUTION |
| 04 | MEASURE | Heart rate, SpO₂ and temperature outside the demo ranges — level WARNING |
| 05 | UNDERSTAND | Findings explained in plain language, data reliability High, rules triggered |
| 06 | UNDERSTAND | Event history — detections and escalations with mission time |
| 07 | ACT | Identified event and "Request medical support now" |
| 08 | ACT | Safety checklists in progress, time-stamped action log |
| 09 | COMMUNICATE | Structured incident report generated (text) |
| 10 | COMMUNICATE | Same report as JSON |
| 11 | COMMUNICATE | Report queued — **awaiting send** (urgent, 12-min one-way delay) |
| 12 | COMMUNICATE | **Sent** — in transit to Earth |
| 13 | COMMUNICATE | **Received** by the simulated ground station |
| 14 | COMMUNICATE | **Response pending** — acknowledgement in transit back to Mars |
| 15 | COMMUNICATE | **Response received** — simulated acknowledgement (no real person reviewed it) |
| 16 | ACT | Final state — both checklists complete, full action log |
