/**
 * FUTURE 01 — pure journal logic: routine schedule, trends and attention flags.
 * Deterministic: the same journal and day always give the same result.
 */
import { JOURNAL_RULES, ROUTINES, SCALES, SYMPTOMS, crewName } from "@/features/journal/config";
import type {
  CheckIn,
  CrewId,
  JournalData,
  JournalFlag,
  MetricKey,
  RoutineStatus,
  TrendPoint,
} from "@/features/journal/types";

/** Latest check-in of each day for one crew member, keyed by mission day. */
export function checkInsByDay(checkIns: CheckIn[], crewId: CrewId): Map<number, CheckIn> {
  const map = new Map<number, CheckIn>();
  for (const c of checkIns) {
    if (c.crewId !== crewId) continue;
    const prev = map.get(c.at.day);
    if (!prev || c.at.minute >= prev.at.minute) map.set(c.at.day, c);
  }
  return map;
}

export function todaysCheckIn(data: JournalData, crewId: CrewId, today: number): CheckIn | null {
  return checkInsByDay(data.checkIns, crewId).get(today) ?? null;
}

export function routineStatuses(data: JournalData, crewId: CrewId, today: number): RoutineStatus[] {
  const byDay = checkInsByDay(data.checkIns, crewId);
  return ROUTINES.map((routine) => {
    let lastDoneDay: number | null = null;
    if (routine.id === "daily-checkin") {
      for (const d of byDay.keys()) if (d <= today && (lastDoneDay === null || d > lastDoneDay)) lastDoneDay = d;
    } else {
      for (const c of data.completions) {
        if (c.crewId === crewId && c.routineId === routine.id && c.at.day <= today && (lastDoneDay === null || c.at.day > lastDoneDay)) {
          lastDoneDay = c.at.day;
        }
      }
    }
    const nextDueDay = lastDoneDay === null ? 1 : lastDoneDay + routine.everyDays;
    const daysLate = today - nextDueDay;
    const state: RoutineStatus["state"] =
      lastDoneDay === today ? "done-today" : nextDueDay < today ? "overdue" : nextDueDay === today ? "due-today" : "upcoming";
    return { routine, crewId, state, lastDoneDay, nextDueDay, daysLate };
  });
}

export function metricSeries(checkIns: CheckIn[], crewId: CrewId, metric: MetricKey, fromDay: number, toDay: number): TrendPoint[] {
  const byDay = checkInsByDay(checkIns, crewId);
  const out: TrendPoint[] = [];
  for (let d = Math.max(1, fromDay); d <= toDay; d++) out.push({ day: d, value: byDay.get(d)?.[metric] ?? null });
  return out;
}

/** Consecutive days (ending at the latest recent check-in) on which `predicate` holds. */
function recentStreak(byDay: Map<number, CheckIn>, today: number, predicate: (c: CheckIn) => boolean): number[] {
  let start: number | null = null;
  for (let d = today; d > today - JOURNAL_RULES.recentWindowDays && d >= 1; d--) {
    if (byDay.has(d)) {
      start = d;
      break;
    }
  }
  if (start === null) return [];
  const days: number[] = [];
  for (let d = start; d >= 1; d--) {
    const c = byDay.get(d);
    if (!c || !predicate(c)) break;
    days.unshift(d);
  }
  return days;
}

const symptomLabel = (id: string) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;

/**
 * Attention flags from the provisional demonstration rules (JOURNAL_RULES).
 * They highlight self-reported patterns for a human to review. They are not a diagnosis.
 */
export function journalFlags(data: JournalData, crewId: CrewId, today: number): JournalFlag[] {
  const byDay = checkInsByDay(data.checkIns, crewId);
  const flags: JournalFlag[] = [];
  const name = crewName(crewId);
  const R = JOURNAL_RULES;

  const streakRule = (
    id: JournalFlag["id"],
    min: number,
    predicate: (c: CheckIn) => boolean,
    title: string,
    detail: (n: number) => string,
  ) => {
    const days = recentStreak(byDay, today, predicate);
    if (days.length >= min) flags.push({ id, crewId, title, detail: detail(days.length), days });
  };

  streakRule(
    "SHORT_SLEEP",
    R.shortSleep.consecutiveDays,
    (c) => c.sleepHours < R.shortSleep.belowHours,
    "Short sleep reported",
    (n) => `${name} reported under ${R.shortSleep.belowHours} h of sleep on ${n} consecutive days. Suggested follow-up: review sleep and workload with the crew medical officer.`,
  );
  streakRule(
    "HIGH_FATIGUE",
    R.highFatigue.consecutiveDays,
    (c) => c.fatigue >= R.highFatigue.atLeast,
    "High fatigue reported",
    (n) => `${name} rated fatigue ${R.highFatigue.atLeast}/5 or higher on ${n} consecutive days. Suggested follow-up: review with the crew medical officer.`,
  );
  streakRule(
    "LOW_MOOD",
    R.lowMood.consecutiveDays,
    (c) => c.mood <= R.lowMood.atMost,
    "Low mood reported",
    (n) => `${name} rated mood ${R.lowMood.atMost}/5 or lower on ${n} consecutive days. Suggested follow-up: offer a private conversation with the crew medical officer or the ground team.`,
  );
  streakRule(
    "LOW_HYDRATION",
    R.lowHydration.consecutiveDays,
    (c) => c.hydration <= R.lowHydration.atMost,
    "Feeling poorly hydrated",
    (n) => `${name} rated hydration ${R.lowHydration.atMost}/5 or lower (“${SCALES.hydration.low}” side) on ${n} consecutive days. Suggested follow-up: record fluid intake in the next check-ins.`,
  );

  const symptomDays: number[] = [];
  const symptoms = new Set<string>();
  for (let d = today; d > today - R.symptomLookbackDays && d >= 1; d--) {
    const c = byDay.get(d);
    if (c && c.symptoms.length) {
      symptomDays.unshift(d);
      c.symptoms.forEach((s) => symptoms.add(s));
    }
  }
  if (symptomDays.length) {
    flags.push({
      id: "SYMPTOM_REPORTED",
      crewId,
      title: "Symptom reported",
      detail: `${name} reported: ${[...symptoms].map(symptomLabel).join(", ")}. Suggested follow-up: run a Symptom Assessment (FUTURE 02).`,
      days: symptomDays,
    });
  }

  const missing: number[] = [];
  for (let d = today - R.missingLookbackDays; d < today; d++) if (d >= 1 && !byDay.has(d)) missing.push(d);
  if (missing.length) {
    flags.push({
      id: "CHECKIN_MISSING",
      crewId,
      title: "Missing check-in",
      detail: `No check-in recorded for ${name} on day${missing.length > 1 ? "s" : ""} ${missing.join(", ")}. Trends for those days have no data.`,
      days: missing,
    });
  }
  return flags;
}

/** Check-in draft validation (input sanity only — not clinical limits). */
export function validateCheckIn(d: {
  sleepHours: number;
  fluidIntakeL: number | null;
  sleepQuality: number;
  mood: number;
  fatigue: number;
  hydration: number;
}): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(d.sleepHours) || d.sleepHours < 0 || d.sleepHours > 24) errors.push("Sleep must be between 0 and 24 hours.");
  if (d.fluidIntakeL !== null && (!Number.isFinite(d.fluidIntakeL) || d.fluidIntakeL < 0 || d.fluidIntakeL > 10))
    errors.push("Fluid intake must be between 0 and 10 litres, or left empty.");
  for (const k of ["sleepQuality", "mood", "fatigue", "hydration"] as const) {
    const v = d[k];
    if (!Number.isInteger(v) || v < 1 || v > 5) errors.push(`${SCALES[k].label} must be a rating from 1 to 5.`);
  }
  return errors;
}
