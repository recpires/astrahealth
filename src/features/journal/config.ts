/**
 * FUTURE 01 configuration.
 *
 * DEMONSTRATION CONTENT: crew roster, routine schedule and journal rules were
 * written by the development team for the prototype. They are not NASA
 * protocols, not clinical criteria and not validated. Change them here.
 */
import type { CrewMember, MetricKey, RoutineDefinition, SymptomId } from "@/features/journal/types";

export const CREW: CrewMember[] = [
  { id: "crew-a", name: "Crew Member A", role: "Commander (simulated)" },
  { id: "crew-b", name: "Crew Member B", role: "Flight Engineer (simulated)" },
  { id: "crew-c", name: "Crew Member C", role: "Mission Specialist (simulated)" },
  { id: "crew-d", name: "Crew Member D", role: "Crew Medical Officer (simulated)" },
];

/** Plain-language symptom list for self-report. Not a diagnostic catalogue. */
export const SYMPTOMS: { id: SymptomId; label: string }[] = [
  { id: "headache", label: "Headache" },
  { id: "nausea", label: "Nausea" },
  { id: "back-pain", label: "Back pain" },
  { id: "congestion", label: "Stuffy nose / congestion" },
  { id: "vision-change", label: "Change in vision" },
  { id: "dizziness", label: "Dizziness" },
  { id: "skin-irritation", label: "Skin irritation" },
  { id: "muscle-soreness", label: "Muscle soreness" },
  { id: "trouble-sleeping", label: "Trouble sleeping" },
  { id: "other", label: "Other (describe in notes)" },
];

/** Meaning of the 1–5 self-ratings, shown next to every input. */
export const SCALES: Record<Exclude<MetricKey, "sleepHours">, { label: string; low: string; high: string; higherIsBetter: boolean }> = {
  sleepQuality: { label: "Sleep quality", low: "very poor", high: "very good", higherIsBetter: true },
  mood: { label: "Mood", low: "very low", high: "very good", higherIsBetter: true },
  fatigue: { label: "Fatigue", low: "none", high: "extreme", higherIsBetter: false },
  hydration: { label: "Hydration (felt)", low: "very thirsty", high: "well hydrated", higherIsBetter: true },
};

/** Demonstration routine schedule (team-defined, not a NASA protocol). */
export const ROUTINES: RoutineDefinition[] = [
  {
    id: "daily-checkin",
    title: "Daily health check-in",
    kind: "self-report",
    everyDays: 1,
    description: "Sleep, mood, fatigue, hydration and symptoms (this journal).",
    equipment: null,
  },
  {
    id: "body-mass",
    title: "Body mass measurement",
    kind: "measurement",
    everyDays: 7,
    description: "Record that the measurement was taken. Values belong to Extended Health Metrics (FUTURE 03).",
    equipment: "Body mass measurement device",
  },
  {
    id: "blood-pressure",
    title: "Blood pressure measurement",
    kind: "measurement",
    everyDays: 7,
    description: "Record that the measurement was taken. Values belong to Extended Health Metrics (FUTURE 03).",
    equipment: "Blood pressure monitor",
  },
  {
    id: "vision-check",
    title: "Visual acuity self-check",
    kind: "exam",
    everyDays: 14,
    description: "Periodic vision self-check. Results are not interpreted by this prototype.",
    equipment: "Vision chart",
  },
];

/** Provisional demonstration rules for journal attention flags (not clinical criteria). */
export const JOURNAL_RULES = {
  id: "ASTRA-JOURNAL",
  version: "0.1.0-demo",
  status: "PROVISIONAL" as const,
  provenance:
    "Demonstration thresholds chosen by the development team to show how self-reported trends can be highlighted. Not clinical criteria, not derived from a NASA source.",
  shortSleep: { belowHours: 6, consecutiveDays: 3 },
  highFatigue: { atLeast: 4, consecutiveDays: 3 },
  lowMood: { atMost: 2, consecutiveDays: 3 },
  lowHydration: { atMost: 2, consecutiveDays: 2 },
  /** Symptoms reported today or in the previous N-1 days raise a flag. */
  symptomLookbackDays: 2,
  /** Days before today checked for a missing check-in. */
  missingLookbackDays: 3,
  /** Streak rules only look at streaks that end today or yesterday. */
  recentWindowDays: 2,
};

export const JOURNAL_RULESET_REF = `${JOURNAL_RULES.id}@${JOURNAL_RULES.version}`;

export function crewName(id: string): string {
  return CREW.find((c) => c.id === id)?.name ?? id;
}

export const METRIC_LABEL: Record<MetricKey, string> = {
  sleepHours: "Sleep (hours)",
  sleepQuality: "Sleep quality (1–5)",
  mood: "Mood (1–5)",
  fatigue: "Fatigue (1–5)",
  hydration: "Hydration felt (1–5)",
};
