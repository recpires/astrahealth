import { LEVEL_RANK, type AnalysisEvent, type Finding } from "@/lib/types";

/**
 * Compares the findings of two consecutive analyses and returns the events
 * that describe what changed. Pure and deterministic.
 */
export function diffFindings(prev: Finding[], next: Finding[], t: number): AnalysisEvent[] {
  const events: AnalysisEvent[] = [];
  const prevById = new Map(prev.map((f) => [f.id, f]));
  const nextById = new Map(next.map((f) => [f.id, f]));

  for (const f of next) {
    const before = prevById.get(f.id);
    if (!before) {
      events.push({
        id: `${t}:${f.id}:detected`,
        t,
        type: "detected",
        level: f.level,
        findingId: f.id,
        category: f.category,
        title: f.title,
        detail: f.evidence,
      });
    } else if (LEVEL_RANK[f.level] !== LEVEL_RANK[before.level]) {
      const up = LEVEL_RANK[f.level] > LEVEL_RANK[before.level];
      events.push({
        id: `${t}:${f.id}:${up ? "escalated" : "de-escalated"}`,
        t,
        type: up ? "escalated" : "de-escalated",
        level: f.level,
        findingId: f.id,
        category: f.category,
        title: f.title,
        detail: `Attention level ${before.level} → ${f.level}. ${f.evidence}`,
      });
    }
  }

  for (const f of prev) {
    if (!nextById.has(f.id)) {
      events.push({
        id: `${t}:${f.id}:cleared`,
        t,
        type: "cleared",
        level: "NOMINAL",
        findingId: f.id,
        category: f.category,
        title: f.title,
        detail: "Condition no longer present in the latest readings.",
      });
    }
  }
  return events;
}

/** Updates the "opened at" map used to know when each active finding started. */
export function updateOpenedAt(
  openedAt: Record<string, number>,
  next: Finding[],
  t: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of next) out[f.id] = openedAt[f.id] ?? t;
  return out;
}
