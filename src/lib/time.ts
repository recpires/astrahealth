const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");

/** Mission elapsed time, e.g. "T+01:02:03". */
export function formatMET(seconds: number): string {
  const sign = seconds < 0 ? "T-" : "T+";
  const s = Math.abs(Math.round(seconds));
  return `${sign}${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`;
}

/** Clock-style mm:ss (or h:mm:ss) used on chart axes. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad((s % 3600) / 60)}:${pad(s % 60)}` : `${pad(s / 60)}:${pad(s % 60)}`;
}

/** Human-readable duration: "45 s", "12 min", "1 h 04 min". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    return r === 0 ? `${m} min` : `${m} min ${pad(r)} s`;
  }
  return `${Math.floor(s / 3600)} h ${pad((s % 3600) / 60)} min`;
}
