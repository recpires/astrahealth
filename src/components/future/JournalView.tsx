"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookHeart, CalendarCheck, Flag, History, LineChart as LineIcon, Send, Users } from "lucide-react";
import { Badge, Button, EmptyState, Panel, cx } from "@/components/ui/primitives";
import type { ToneName } from "@/components/ui/levels";
import { CrewPicker, Field, Note, Segmented, SourceTag, inputClass } from "@/components/future/common";
import { CREW, JOURNAL_RULES, JOURNAL_RULESET_REF, METRIC_LABEL, SCALES, SYMPTOMS, crewName } from "@/features/journal/config";
import { checkInsByDay, journalFlags, metricSeries, routineStatuses, todaysCheckIn, validateCheckIn } from "@/features/journal/logic";
import type { CheckIn, CrewId, MetricKey, Rating, RoutineState, SymptomId } from "@/features/journal/types";
import { useFuture } from "@/features/platform/FutureProvider";
import { formatClockOfDay, formatMissionTime } from "@/features/platform/time";

const ROUTINE_TONE: Record<RoutineState, ToneName> = { overdue: "caution", "due-today": "advisory", upcoming: "neutral", "done-today": "nominal" };
const ROUTINE_TEXT: Record<RoutineState, string> = { overdue: "Overdue", "due-today": "Due today", upcoming: "Upcoming", "done-today": "Done today" };
const RATING_KEYS = ["sleepQuality", "mood", "fatigue", "hydration"] as const;

function CheckInForm({ crewId, existing }: { crewId: CrewId; existing: CheckIn | null }) {
  const { dispatch } = useFuture();
  const [sleepHours, setSleepHours] = useState(existing ? String(existing.sleepHours) : "");
  const [fluid, setFluid] = useState(existing?.fluidIntakeL != null ? String(existing.fluidIntakeL) : "");
  const [ratings, setRatings] = useState<Record<(typeof RATING_KEYS)[number], Rating>>({
    sleepQuality: existing?.sleepQuality ?? 3,
    mood: existing?.mood ?? 3,
    fatigue: existing?.fatigue ?? 2,
    hydration: existing?.hydration ?? 3,
  });
  const [symptoms, setSymptoms] = useState<SymptomId[]>(existing?.symptoms ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const draft = {
      sleepHours: sleepHours.trim() === "" ? NaN : Number(sleepHours),
      fluidIntakeL: fluid.trim() === "" ? null : Number(fluid),
      ...ratings,
      symptoms,
      notes,
    };
    const errs = validateCheckIn(draft);
    setErrors(errs);
    if (errs.length) return;
    dispatch({ type: "journal/submit-checkin", crewId, draft });
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Sleep last night (hours)" hint="0–24 h">
          <input className={inputClass} inputMode="decimal" value={sleepHours} onChange={(e) => setSleepHours(e.target.value)} data-testid="checkin-sleep" />
        </Field>
        <Field label="Fluid intake, last 24 h (litres)" hint="Optional self-estimate">
          <input className={inputClass} inputMode="decimal" value={fluid} onChange={(e) => setFluid(e.target.value)} data-testid="checkin-fluid" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {RATING_KEYS.map((k) => (
          <div key={k}>
            <Segmented
              label={`${SCALES[k].label} (1 = ${SCALES[k].low}, 5 = ${SCALES[k].high})`}
              value={String(ratings[k])}
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => setRatings((r) => ({ ...r, [k]: Number(v) as Rating }))}
              testId={`checkin-${k}`}
            />
          </div>
        ))}
      </div>
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-muted">Symptoms today (self-report, not a diagnosis)</legend>
        <div className="flex flex-wrap gap-1.5">
          {SYMPTOMS.map((s) => {
            const on = symptoms.includes(s.id);
            return (
              <label
                key={s.id}
                className={cx(
                  "cursor-pointer rounded-md border px-2 py-1 text-xs",
                  on ? "border-level-caution/50 bg-level-caution/10 text-level-caution" : "border-line text-ink-muted hover:text-ink",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={on}
                  onChange={() => setSymptoms((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                  data-testid={`checkin-symptom-${s.id}`}
                />
                {s.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      <Field label="Notes (optional)">
        <textarea className={cx(inputClass, "min-h-16")} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {errors.length > 0 && (
        <ul className="rounded-lg border border-level-warning/40 bg-level-warning/10 px-3 py-2 text-xs text-level-warning" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" icon={BookHeart} data-testid="checkin-submit">
          {existing ? "Update today's check-in" : "Save check-in"}
        </Button>
        {existing?.source === "crew-entry" && !errors.length && (
          <span className="text-xs text-level-nominal" role="status" data-testid="checkin-saved">
            Saved for {crewName(crewId)} · {formatMissionTime(existing.at)} · stored on this device
          </span>
        )}
      </div>
    </form>
  );
}

function TrendChart({ crewId, today }: { crewId: CrewId; today: number }) {
  const { state } = useFuture();
  const [metric, setMetric] = useState<MetricKey>("sleepHours");
  const data = useMemo(() => metricSeries(state.journal.checkIns, crewId, metric, today - 13, today), [state.journal.checkIns, crewId, metric, today]);
  const yDomain: [number, number] = metric === "sleepHours" ? [0, 10] : [1, 5];
  const missing = data.filter((d) => d.value === null).map((d) => d.day);
  return (
    <div>
      <Segmented
        label="Metric"
        value={metric}
        options={(Object.keys(METRIC_LABEL) as MetricKey[]).map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
        onChange={setMetric}
        testId="trend-metric"
      />
      <div className="mt-3 h-48" data-testid="trend-chart">
        <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 500, height: 192 }}>
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="#1a3159" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: "#7a8fb3", fontSize: 11 }} tickFormatter={(d) => `D${d}`} stroke="#1a3159" />
            <YAxis domain={yDomain} tick={{ fill: "#7a8fb3", fontSize: 11 }} stroke="#1a3159" allowDecimals={metric === "sleepHours"} />
            <Tooltip
              contentStyle={{ background: "#071226", border: "1px solid #24427a", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(d) => `Mission day ${d}`}
              formatter={(v) => [v ?? "no entry", METRIC_LABEL[metric]]}
            />
            <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} dot={{ r: 3, fill: "#22d3ee" }} connectNulls={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-ink-faint">
        Self-reported values, last 14 mission days. {missing.length ? `No entry on day ${missing.join(", ")} (gap left in the line).` : "No missing days."}
      </p>
    </div>
  );
}

export function JournalView() {
  const { state, dispatch, crewId } = useFuture();
  const today = state.platform.clock.day;
  const existing = todaysCheckIn(state.journal, crewId, today);
  const flags = journalFlags(state.journal, crewId, today);
  const routines = routineStatuses(state.journal, crewId, today);
  const history = [...checkInsByDay(state.journal.checkIns, crewId).values()].filter((c) => c.at.day > today - 14).sort((a, b) => b.at.day - a.at.day);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">FUTURE 01 · Health Journal &amp; Daily Check</h1>
          <p className="text-sm text-ink-muted">Daily self-report, routines and trends — stored on this device, works without the Earth link.</p>
        </div>
        <CrewPicker />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel
          title={`Today's check-in — ${crewName(crewId)} — mission day ${today}`}
          icon={BookHeart}
          className="xl:col-span-2"
          actions={existing ? <Badge tone="nominal">Done {formatClockOfDay(existing.at.minute)}</Badge> : <Badge tone="advisory">Pending</Badge>}
        >
          <CheckInForm key={`${crewId}-${today}-${existing?.id ?? "new"}`} crewId={crewId} existing={existing} />
        </Panel>

        <Panel
          title="Attention flags"
          icon={Flag}
          eyebrow="Demonstration rules"
          actions={
            <Button size="sm" icon={Send} onClick={() => dispatch({ type: "journal/queue-summary", crewId })} data-testid="journal-queue-summary">
              Queue summary
            </Button>
          }
        >
          <div className="space-y-2" data-testid="journal-flags">
            <p className="font-mono text-[10px] text-ink-faint">
              {JOURNAL_RULESET_REF} · {JOURNAL_RULES.status}
            </p>
            {flags.length === 0 ? (
              <EmptyState>No flags for {crewName(crewId)}.</EmptyState>
            ) : (
              flags.map((f) => (
                <div key={f.id} className="rounded-lg border border-level-caution/40 bg-level-caution/5 p-2.5" data-testid={`flag-${f.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-level-caution">{f.title}</p>
                    <span className="font-mono text-[10px] text-ink-faint">{f.id}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.detail}</p>
                  <p className="mt-1 text-[11px] text-ink-faint">Days: {f.days.join(", ")}</p>
                </div>
              ))
            )}
            <Note>{JOURNAL_RULES.provenance} Flags point a human to a pattern; they are not a diagnosis.</Note>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Routines" icon={CalendarCheck} eyebrow="Demonstration schedule — not a NASA protocol">
          <ul className="space-y-2">
            {routines.map((r) => (
              <li key={r.routine.id} className="rounded-lg border border-line p-2.5" data-testid={`routine-${r.routine.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{r.routine.title}</p>
                    <p className="text-[11px] text-ink-faint">
                      Every {r.routine.everyDays === 1 ? "day" : `${r.routine.everyDays} days`} · last {r.lastDoneDay ? `day ${r.lastDoneDay}` : "never"} · next due day {r.nextDueDay}
                      {r.state === "overdue" ? ` (${r.daysLate} d late)` : ""}
                    </p>
                  </div>
                  <Badge tone={ROUTINE_TONE[r.state]}>{ROUTINE_TEXT[r.state]}</Badge>
                </div>
                {r.routine.equipment && <p className="mt-1 text-[11px] text-ink-faint">Equipment: {r.routine.equipment}</p>}
                {r.routine.id !== "daily-checkin" && r.state !== "done-today" && (
                  <Button
                    size="sm"
                    className="mt-2"
                    onClick={() => dispatch({ type: "journal/complete-routine", crewId, routineId: r.routine.id, note: "" })}
                    data-testid={`routine-done-${r.routine.id}`}
                  >
                    Mark done
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="14-day trend" icon={LineIcon} className="xl:col-span-2">
          <TrendChart crewId={crewId} today={today} />
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={`History — ${crewName(crewId)}`} icon={History} className="xl:col-span-2" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs" data-testid="journal-history">
              <thead className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                <tr>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Sleep</th>
                  <th className="px-3 py-2">Quality</th>
                  <th className="px-3 py-2">Mood</th>
                  <th className="px-3 py-2">Fatigue</th>
                  <th className="px-3 py-2">Hydration</th>
                  <th className="px-3 py-2">Symptoms</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((c) => (
                  <tr key={c.id} className="border-b border-line/50 text-ink-muted">
                    <td className="tabular px-3 py-1.5 font-mono text-ink">
                      D{c.at.day} {formatClockOfDay(c.at.minute)}
                    </td>
                    <td className="tabular px-3 py-1.5">{c.sleepHours} h</td>
                    <td className="px-3 py-1.5">{c.sleepQuality}/5</td>
                    <td className="px-3 py-1.5">{c.mood}/5</td>
                    <td className="px-3 py-1.5">{c.fatigue}/5</td>
                    <td className="px-3 py-1.5">{c.hydration}/5</td>
                    <td className="px-3 py-1.5">{c.symptoms.map((s) => SYMPTOMS.find((x) => x.id === s)?.label ?? s).join(", ") || "—"}</td>
                    <td className="px-3 py-1.5">
                      <SourceTag source={c.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Crew overview — today" icon={Users}>
          <ul className="space-y-2" data-testid="crew-overview">
            {CREW.map((c) => {
              const done = todaysCheckIn(state.journal, c.id, today);
              const f = journalFlags(state.journal, c.id, today);
              const overdue = routineStatuses(state.journal, c.id, today).filter((r) => r.state === "overdue").length;
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2.5 py-2">
                  <span className="text-sm text-ink">{c.name}</span>
                  <span className="flex flex-wrap justify-end gap-1">
                    <Badge tone={done ? "nominal" : "advisory"}>{done ? "Checked in" : "No check-in"}</Badge>
                    {f.length > 0 && <Badge tone="caution">{f.length} flag{f.length > 1 ? "s" : ""}</Badge>}
                    {overdue > 0 && <Badge tone="caution">{overdue} overdue</Badge>}
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Note>
              All journal content in this prototype is simulated (demo seed: days 1–14) or typed in during the demo. Routine completions only record that a task
              was done; measured values go to the Space Health Profile (FUTURE 03).
            </Note>
          </div>
        </Panel>
      </div>
    </div>
  );
}
