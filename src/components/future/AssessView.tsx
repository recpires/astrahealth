"use client";

import { useState } from "react";
import { BookOpen, Check, ClipboardList, Gauge, History, ListChecks, Send, ShieldQuestion, Stethoscope, UserCheck } from "lucide-react";
import { Badge, Button, EmptyState, Panel, cx } from "@/components/ui/primitives";
import type { ToneName } from "@/components/ui/levels";
import { CrewPicker, Field, Note, PRIORITY_TONE, ReferenceLink, Segmented, inputClass } from "@/components/future/common";
import {
  LEVEL_LABEL,
  SYMPTOM_RULESET,
  SYMPTOM_RULESET_REF,
  validateAssessmentInput,
  type AssessmentInput,
  type AssessmentLevel,
  type Onset,
  type Severity,
  type SymptomTrend,
} from "@/features/assess/engine";
import type { AssessmentRecord } from "@/features/assess/reducer";
import { SYMPTOMS, crewName } from "@/features/journal/config";
import type { CrewId, SymptomId } from "@/features/journal/types";
import { useFuture } from "@/features/platform/FutureProvider";
import { formatMissionTime } from "@/features/platform/time";

export const ASSESS_TONE: Record<AssessmentLevel, ToneName> = {
  monitor: "advisory",
  "inform-cmo": "caution",
  "support-recommended": "caution",
  "support-now": "warning",
};

const symptomLabel = (id: string) => SYMPTOMS.find((s) => s.id === id)?.label ?? id;

function IntakeForm({ crewId }: { crewId: CrewId }) {
  const { dispatch } = useFuture();
  const [symptom, setSymptom] = useState<SymptomId>("headache");
  const [severity, setSeverity] = useState<Severity>("mild");
  const [onset, setOnset] = useState<Onset>("unknown");
  const [trend, setTrend] = useState<SymptomTrend>("unknown");
  const [duration, setDuration] = useState("");
  const [duties, setDuties] = useState<"yes" | "no" | "unanswered">("unanswered");
  const [warningSigns, setWarningSigns] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const input: AssessmentInput = {
      crewId,
      symptom,
      severity,
      onset,
      trend,
      durationHours: duration.trim() === "" ? null : Number(duration),
      canPerformDuties: duties === "unanswered" ? null : duties === "yes",
      warningSigns,
      notes,
    };
    const errs = validateAssessmentInput(input);
    setErrors(errs);
    if (!errs.length) dispatch({ type: "assess/submit", input });
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label="Main symptom">
        <select className={inputClass} value={symptom} onChange={(e) => setSymptom(e.target.value as SymptomId)} data-testid="assess-symptom">
          {SYMPTOMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <Segmented
        label="How strong is it? (crew member's own rating)"
        value={severity}
        options={[
          { value: "mild", label: "Mild" },
          { value: "moderate", label: "Moderate" },
          { value: "severe", label: "Severe" },
        ]}
        onChange={setSeverity}
        testId="assess-severity"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Segmented
          label="How did it start?"
          value={onset}
          options={[
            { value: "sudden", label: "Suddenly" },
            { value: "gradual", label: "Gradually" },
            { value: "unknown", label: "Not sure" },
          ]}
          onChange={setOnset}
          testId="assess-onset"
        />
        <Segmented
          label="Since it started it is…"
          value={trend}
          options={[
            { value: "improving", label: "Better" },
            { value: "unchanged", label: "Same" },
            { value: "worsening", label: "Worse" },
            { value: "unknown", label: "Not sure" },
          ]}
          onChange={setTrend}
          testId="assess-trend"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="How long, in hours?" hint="Leave empty if unknown">
          <input className={inputClass} inputMode="decimal" value={duration} onChange={(e) => setDuration(e.target.value)} data-testid="assess-duration" />
        </Field>
        <Segmented
          label="Can the crew member do their duties?"
          value={duties}
          options={[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unanswered", label: "Not answered" },
          ]}
          onChange={setDuties}
          testId="assess-duties"
        />
      </div>
      <fieldset className="rounded-lg border border-level-warning/30 p-2.5">
        <legend className="px-1 text-xs font-medium text-level-warning">Warning signs present now?</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {SYMPTOM_RULESET.warningSigns.map((w) => (
            <label
              key={w.id}
              className={cx(
                "flex min-h-9 cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 text-xs has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                warningSigns.includes(w.id) ? "border-level-warning/60 bg-level-warning/10 text-ink" : "border-line text-ink-muted hover:text-ink",
              )}
            >
              <input
                type="checkbox"
                className="sr-only"
                checked={warningSigns.includes(w.id)}
                onChange={() => setWarningSigns((cur) => (cur.includes(w.id) ? cur.filter((x) => x !== w.id) : [...cur, w.id]))}
                data-testid={`assess-warning-${w.id}`}
              />
              <span
                aria-hidden
                className={cx(
                  "mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  warningSigns.includes(w.id) ? "border-level-warning bg-level-warning text-space-950" : "border-line-strong",
                )}
              >
                {warningSigns.includes(w.id) && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              {w.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-faint">Demonstration list used only to suggest immediate contact with medical support. Not a diagnostic checklist.</p>
      </fieldset>
      <Field label="Notes (optional)">
        <textarea className={cx(inputClass, "min-h-14")} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      {errors.length > 0 && (
        <ul role="alert" className="rounded-lg border border-level-warning/40 bg-level-warning/10 px-3 py-2 text-xs text-level-warning">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <Button type="submit" variant="primary" icon={Stethoscope} data-testid="assess-submit">
        Run assessment
      </Button>
    </form>
  );
}

function ReviewBox({ rec }: { rec: AssessmentRecord }) {
  const { dispatch } = useFuture();
  const [by, setBy] = useState("Crew medical officer");
  const [note, setNote] = useState("");
  if (rec.review) {
    return (
      <div className="rounded-lg border border-line p-2.5 text-xs" data-testid="assess-review-done">
        <Badge tone={rec.review.decision === "accepted" ? "nominal" : "caution"}>{rec.review.decision === "accepted" ? "Proposal accepted" : "Proposal overridden"}</Badge>
        <p className="mt-1 text-ink-muted">
          {rec.review.by} · {formatMissionTime(rec.review.at)}
          {rec.review.note ? ` — “${rec.review.note}”` : ""}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-2.5">
      <p className="text-xs font-semibold text-accent">Human review required — the system only proposes.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Reviewed by">
          <input className={inputClass} value={by} onChange={(e) => setBy(e.target.value)} />
        </Field>
        <Field label="Note (required to override)">
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} data-testid="review-note" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" icon={UserCheck} onClick={() => dispatch({ type: "assess/review", recordId: rec.id, decision: "accepted", by, note })} data-testid="review-accept">
          Accept proposal
        </Button>
        <Button
          size="sm"
          disabled={!note.trim()}
          onClick={() => dispatch({ type: "assess/review", recordId: rec.id, decision: "overridden", by, note })}
          data-testid="review-override"
        >
          Override with note
        </Button>
      </div>
    </div>
  );
}

function ResultPanel({ rec }: { rec: AssessmentRecord }) {
  const { dispatch } = useFuture();
  const o = rec.output;
  return (
    <div className="space-y-4" data-testid="assess-result">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ASSESS_TONE[o.level]} pulse={o.level === "support-now"}>
          <span data-testid="assess-level">{LEVEL_LABEL[o.level]}</span>
        </Badge>
        <span className="text-xs text-ink-muted">
          {rec.id} · {crewName(rec.crewId)} · {symptomLabel(rec.input.symptom)} ({rec.input.severity}) · {formatMissionTime(rec.at)}
        </span>
      </div>

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          <ListChecks aria-hidden className="h-3.5 w-3.5" /> Proposed next steps · {o.ruleSet}
        </h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink" data-testid="assess-steps">
          {o.steps.map((s) => (
            <li key={s.id}>
              {s.text} <span className="font-mono text-[10px] text-ink-faint">[{s.id}]</span>
            </li>
          ))}
        </ol>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          Matched rules: {o.matchedRules.map((r) => `${r.id} (${r.description})`).join(" · ")}
        </p>
      </section>

      <section>
        <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">
          <BookOpen aria-hidden className="h-3.5 w-3.5" /> Evidence used
        </h3>
        <ul className="space-y-1 text-xs text-ink-muted" data-testid="assess-local-evidence">
          {o.evidence.local.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
        <ul className="mt-2 space-y-2" data-testid="assess-science">
          {o.evidence.scientific.map((s) => (
            <li key={s.refId} className="rounded-lg border border-line p-2 text-xs">
              <ReferenceLink refId={s.refId} />
              {s.excerpt ? (
                <blockquote className="mt-1.5 border-l-2 border-accent/40 pl-2 italic text-ink-muted">
                  “{s.excerpt.text}”<span className="not-italic text-ink-faint"> — {s.excerpt.where}</span>
                </blockquote>
              ) : (
                <p className="mt-1 text-ink-faint">Only the official title and link are stored offline; no content is quoted or summarised.</p>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-ink-faint">{o.evidence.association}</p>
      </section>

      <section className={cx("rounded-lg border p-2.5", o.uncertainty.level === "high" ? "border-level-caution/50 bg-level-caution/5" : "border-line")}>
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-level-caution">
          <ShieldQuestion aria-hidden className="h-3.5 w-3.5" /> Uncertainty: <span data-testid="assess-uncertainty">{o.uncertainty.level.toUpperCase()}</span>
        </h3>
        <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
          {o.uncertainty.reasons.map((r) => (
            <li key={r}>• {r}</li>
          ))}
        </ul>
      </section>

      <ReviewBox rec={rec} />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={Send}
          disabled={rec.reportQueued}
          onClick={() => dispatch({ type: "assess/queue-report", recordId: rec.id })}
          data-testid="assess-queue"
        >
          {rec.reportQueued ? "Report queued" : "Queue report to Earth"}
        </Button>
        <Badge tone={PRIORITY_TONE[o.suggestedPriority ?? "routine"]}>{o.suggestedPriority ?? "routine"}</Badge>
        <span className="text-[11px] text-ink-faint">Sent automatically, in priority order, when the Earth link is available.</span>
      </div>
      <p className="font-mono text-[10px] text-ink-faint">
        rule set checksum {o.ruleSetChecksum} · input checksum {o.inputChecksum}
      </p>
    </div>
  );
}

export function AssessView() {
  const { state, crewId } = useFuture();
  const [selected, setSelected] = useState<string | null>(null);
  const records = state.assess.records;
  const latestForCrew = [...records].reverse().find((r) => r.crewId === crewId) ?? null;
  const shown = records.find((r) => r.id === selected) ?? latestForCrew;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">FUTURE 02 · Symptom Assessment &amp; Evidence Engine</h1>
          <p className="text-sm text-ink-muted">Structured questions → versioned rules → proposed next steps, with the evidence and uncertainty behind them.</p>
        </div>
        <CrewPicker />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Panel title={`Assessment — ${crewName(crewId)}`} icon={ClipboardList} className="xl:col-span-2">
          <IntakeForm key={crewId} crewId={crewId} />
        </Panel>
        <Panel title="Result" icon={Gauge} className="xl:col-span-3" eyebrow={`Rule set ${SYMPTOM_RULESET_REF} · ${SYMPTOM_RULESET.status}`}>
          {shown ? <ResultPanel rec={shown} /> : <EmptyState>No assessment yet for {crewName(crewId)}. Fill in the questions and run the assessment.</EmptyState>}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Assessment history (all crew)" icon={History} className="xl:col-span-2" bodyClassName="p-0">
          {records.length === 0 ? (
            <div className="p-4">
              <EmptyState>No assessments recorded.</EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line/60" data-testid="assess-history">
              {[...records].reverse().map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelected(r.id)} className="flex w-full flex-wrap items-center gap-2 px-4 py-2 text-left text-xs hover:bg-space-800/60">
                    <span className="font-mono text-ink-faint">{r.id}</span>
                    <span className="text-ink">{crewName(r.crewId)}</span>
                    <span className="text-ink-muted">{symptomLabel(r.input.symptom)}</span>
                    <Badge tone={ASSESS_TONE[r.output.level]}>{LEVEL_LABEL[r.output.level]}</Badge>
                    <Badge tone={r.review ? "nominal" : "advisory"}>{r.review ? r.review.decision : "awaiting review"}</Badge>
                    {r.reportQueued && <Badge tone="accent">queued</Badge>}
                    <span className="ml-auto text-ink-faint">{formatMissionTime(r.at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="How this engine works" icon={BookOpen}>
          <div className="space-y-2 text-xs leading-relaxed text-ink-muted">
            <p>
              <strong className="text-ink">Operational output</strong> (level, steps, medical-support suggestion) comes only from the versioned rule set{" "}
              <span className="font-mono">{SYMPTOM_RULESET_REF}</span>. Every run records the matched rules and a checksum of the inputs.
            </p>
            <p>
              <strong className="text-ink">Evidence</strong> lists journal facts and official NASA Human Research Program references stored on board. Verified excerpts are quoted
              word for word; reference-only entries are links with no summary.
            </p>
            <p>
              <strong className="text-ink">Uncertainty</strong> is always shown and is never “low”, because the rules are demonstration rules.
            </p>
            <p>No language model is used. A future explanation layer may summarise science, but it would not change the proposed steps.</p>
            <Note tone="caution">{SYMPTOM_RULESET.provenance}</Note>
          </div>
        </Panel>
      </div>
    </div>
  );
}
