#!/usr/bin/env node
/**
 * Generates the DEMONSTRATION seed data of the FUTURE modules (deterministic, seeded PRNG):
 *
 *   src/data/future/journal-demo.json  — FUTURE 01: 14 days of daily check-ins and routine completions
 *   src/data/future/profile-demo.json  — FUTURE 03: crew-entered device readings (body mass, blood pressure, visual acuity)
 *
 * Everything here is SIMULATED for the prototype. No value comes from a real person or a NASA dataset.
 * Run: npm run generate:future
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src", "data", "future");

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261115);
const between = (lo, hi) => lo + (hi - lo) * rand();
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const clampRating = (v) => Math.min(5, Math.max(1, Math.round(v)));

const DAYS = 14;
const CREW = ["crew-a", "crew-b", "crew-c", "crew-d"];

/** Per-crew storyline used to make the demo flags appear. */
function profileFor(crewId, day) {
  const base = {
    sleepHours: between(6.6, 7.8),
    sleepQuality: pick([3, 4, 4, 5]),
    mood: pick([3, 4, 4, 5]),
    fatigue: pick([1, 2, 2, 3]),
    hydration: pick([3, 4, 4, 5]),
    fluidIntakeL: between(2.0, 2.8),
    symptoms: [],
    notes: "",
  };
  if (crewId === "crew-b" && day >= 10) {
    // Storyline: short sleep and rising fatigue during a heavy work block.
    return { ...base, sleepHours: between(4.8, 5.6), sleepQuality: 2, fatigue: day >= 12 ? 5 : 4, mood: 3, symptoms: day >= 13 ? ["trouble-sleeping"] : [], notes: day === 10 ? "Late payload operations." : "" };
  }
  if (crewId === "crew-c" && day >= 13) {
    // Storyline: feeling poorly hydrated, headache and congestion on the last two days.
    return { ...base, hydration: 2, fluidIntakeL: between(1.2, 1.5), symptoms: day === 13 ? ["headache"] : ["headache", "congestion"], notes: day === 14 ? "Headache in the morning." : "" };
  }
  if (crewId === "crew-a" && day === 7) {
    return { ...base, symptoms: ["back-pain"], notes: "Mild back ache after exercise session." };
  }
  return base;
}

const checkIns = [];
let n = 0;
for (let day = 1; day <= DAYS; day++) {
  for (const crewId of CREW) {
    // Storyline: Crew Member D skipped the check-in on days 12 and 14.
    if (crewId === "crew-d" && (day === 12 || day === 14)) continue;
    const p = profileFor(crewId, day);
    checkIns.push({
      id: `SEED-CI-${String(++n).padStart(3, "0")}`,
      crewId,
      at: { day, minute: 450 + Math.floor(rand() * 60) },
      sleepHours: round(p.sleepHours, 1),
      sleepQuality: clampRating(p.sleepQuality),
      mood: clampRating(p.mood),
      fatigue: clampRating(p.fatigue),
      hydration: clampRating(p.hydration),
      fluidIntakeL: round(p.fluidIntakeL, 1),
      symptoms: p.symptoms,
      notes: p.notes,
      source: "demo-seed",
    });
  }
}

const COMPLETIONS = {
  "body-mass": { "crew-a": [1, 8], "crew-b": [1, 8], "crew-c": [1, 8], "crew-d": [1] },
  "blood-pressure": { "crew-a": [1, 8], "crew-b": [1, 8], "crew-c": [3], "crew-d": [1, 8] },
  "vision-check": { "crew-a": [1], "crew-b": [1], "crew-c": [1], "crew-d": [1] },
};
const completions = [];
let c = 0;
for (const [routineId, perCrew] of Object.entries(COMPLETIONS)) {
  for (const [crewId, days] of Object.entries(perCrew)) {
    for (const day of days) {
      completions.push({
        id: `SEED-RC-${String(++c).padStart(3, "0")}`,
        routineId,
        crewId,
        at: { day, minute: 540 },
        note: "Value recorded in the Space Health Profile (FUTURE 03).",
        source: "demo-seed",
      });
    }
  }
}

// FUTURE 03 crew-entered device readings, matching the routine completions above.
const BODY_MASS = { "crew-a": 78.4, "crew-b": 64.2, "crew-c": 71.0, "crew-d": 85.3 };
const BP = { "crew-a": [118, 76], "crew-b": [112, 72], "crew-c": [121, 79], "crew-d": [124, 80] };
const entries = [];
let e = 0;
const entry = (metricId, crewId, day, value) =>
  entries.push({
    id: `SEED-ME-${String(++e).padStart(3, "0")}`,
    metricId,
    crewId,
    at: { day, minute: 540 },
    value,
    quality: "good",
    note: "",
    source: "demo-seed",
  });
for (const crewId of CREW) {
  for (const day of COMPLETIONS["body-mass"][crewId]) entry("body-mass", crewId, day, round(BODY_MASS[crewId] - (day > 1 ? between(0.2, 0.5) : 0), 1));
  for (const day of COMPLETIONS["blood-pressure"][crewId]) {
    entry("bp-systolic", crewId, day, BP[crewId][0] + (day > 1 ? Math.round(between(-3, 3)) : 0));
    entry("bp-diastolic", crewId, day, BP[crewId][1] + (day > 1 ? Math.round(between(-2, 2)) : 0));
  }
  entry("visual-acuity", crewId, 1, 1.0);
}

const meta = {
  generatedBy: "scripts/generate-future-demo.mjs",
  seed: 20261115,
  simulated: true,
  disclaimer: "Demonstration data generated for the ASTRA Health prototype. Not real crew data.",
};

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "journal-demo.json"), JSON.stringify({ ...meta, schemaVersion: 1, checkIns, completions }, null, 2) + "\n");
writeFileSync(join(OUT, "profile-demo.json"), JSON.stringify({ ...meta, schemaVersion: 1, entries }, null, 2) + "\n");
console.log(`journal-demo.json: ${checkIns.length} check-ins, ${completions.length} routine completions`);
console.log(`profile-demo.json: ${entries.length} device readings`);
