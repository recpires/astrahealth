import type { MissionTime } from "@/features/platform/types";

export const MINUTES_PER_DAY = 1440;

export function toAbsMinutes(t: MissionTime): number {
  return (t.day - 1) * MINUTES_PER_DAY + t.minute;
}

export function fromAbsMinutes(abs: number): MissionTime {
  const m = Math.max(0, Math.round(abs));
  const day = Math.floor(m / MINUTES_PER_DAY);
  return { day: day + 1, minute: m - day * MINUTES_PER_DAY };
}

export function addMinutes(t: MissionTime, minutes: number): MissionTime {
  return fromAbsMinutes(toAbsMinutes(t) + minutes);
}

export function compareTime(a: MissionTime, b: MissionTime): number {
  return toAbsMinutes(a) - toAbsMinutes(b);
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClockOfDay(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

/** "Day 15 · 08:00" */
export function formatMissionTime(t: MissionTime): string {
  return `Day ${t.day} · ${formatClockOfDay(t.minute)}`;
}
