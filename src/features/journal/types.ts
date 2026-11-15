/**
 * FUTURE 01 — Health Journal & Daily Check: domain types.
 *
 * This module is independent from the mission simulation (src/lib/mission):
 * it has its own state, rules and on-device storage.
 * All journal data in the prototype is demonstration data.
 */

import type { MissionTime } from "@/features/platform/types";

export type { MissionTime };

export type CrewId = "crew-a" | "crew-b" | "crew-c" | "crew-d";

export interface CrewMember {
  id: CrewId;
  name: string;
  role: string;
}

/** 1–5 self-rating. Meaning depends on the field (see SCALES in config.ts). */
export type Rating = 1 | 2 | 3 | 4 | 5;

export type SymptomId =
  | "headache"
  | "nausea"
  | "back-pain"
  | "congestion"
  | "vision-change"
  | "dizziness"
  | "skin-irritation"
  | "muscle-soreness"
  | "trouble-sleeping"
  | "other";

/** Where an entry comes from. Both are demonstration data in this prototype. */
export type EntrySource = "demo-seed" | "crew-entry";

export interface CheckIn {
  id: string;
  crewId: CrewId;
  at: MissionTime;
  sleepHours: number;
  sleepQuality: Rating;
  mood: Rating;
  fatigue: Rating;
  hydration: Rating;
  /** Optional self-estimated fluid intake over the last 24 h (litres). */
  fluidIntakeL: number | null;
  symptoms: SymptomId[];
  notes: string;
  source: EntrySource;
}

export type RoutineKind = "self-report" | "measurement" | "exam";

export interface RoutineDefinition {
  id: string;
  title: string;
  kind: RoutineKind;
  everyDays: number;
  description: string;
  /** Equipment needed, if any (no measurement is simulated here). */
  equipment: string | null;
}

export interface RoutineCompletion {
  id: string;
  routineId: string;
  crewId: CrewId;
  at: MissionTime;
  note: string;
  source: EntrySource;
}

export interface JournalData {
  schemaVersion: 1;
  checkIns: CheckIn[];
  completions: RoutineCompletion[];
}

export type RoutineState = "overdue" | "due-today" | "upcoming" | "done-today";

export interface RoutineStatus {
  routine: RoutineDefinition;
  crewId: CrewId;
  state: RoutineState;
  lastDoneDay: number | null;
  nextDueDay: number;
  /** Positive when overdue, negative when upcoming. */
  daysLate: number;
}

export type JournalFlagId = "SHORT_SLEEP" | "HIGH_FATIGUE" | "LOW_MOOD" | "LOW_HYDRATION" | "SYMPTOM_REPORTED" | "CHECKIN_MISSING";

/** What the crew fills in; time, id and source are added by the reducer. */
export type CheckInDraft = Omit<CheckIn, "id" | "at" | "source" | "crewId">;

export interface JournalFlag {
  id: JournalFlagId;
  crewId: CrewId;
  title: string;
  detail: string;
  /** Mission days that triggered the flag. */
  days: number[];
}

export type MetricKey = "sleepHours" | "sleepQuality" | "mood" | "fatigue" | "hydration";

export interface TrendPoint {
  day: number;
  value: number | null;
}
