"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, ClipboardCheck, Gavel, History, Rocket, Wrench } from "lucide-react";
import { Badge, Button, EmptyState, Panel, cx } from "@/components/ui/primitives";
import { Field, Note, PRIORITY_TONE, ReferenceLink, inputClass } from "@/components/future/common";
import { OutboxPanel } from "@/components/future/OutboxPanel";
import { EVA_PROTOCOL, EVA_PROTOCOL_REF, checklistStatus, gateProposal, type CheckStatus, type EvaPhase, type EvaSession } from "@/features/eva/logic";
import { CREW, crewName } from "@/features/journal/config";
import type { CrewId } from "@/features/journal/types";
import { useFuture } from "@/features/platform/FutureProvider";
import { formatMissionTime } from "@/features/platform/time";

const PHASES: { id: EvaPhase; label: string }[] = [
  { id: "pre", label: "Pre-EVA" },
  { id: "during", label: "During EVA" },
  { id: "post", label: "Post-EVA" },
  { id: "closed", label: "Closed" },
];

function useEvaContext() {
  const { state } = useFuture();
  return { now: state.platform.clock, journal: state.journal, assess: state.assess, link: state.platform.link };
}

function Checklist({ items, phase, active }: { items: CheckStatus[]; phase: string; active: boolean }) {
  const { dispatch } = useFuture();
  return (
    <ul className="space-y-1.5" data-testid={`eva-checklist-${phase}`}>
      {items.map((c) => (
        <li key={c.item.id} className={cx("rounded-lg border p-2", c.done ? "border-level-nominal/30" : "border-line")} data-testid={`eva-item-${c.item.id}`}>
          <div className="flex items-start gap-2">
            {c.done ? <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-level-nominal" /> : <Circle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />}
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="mr-1 font-mono text-[10px] text-ink-faint">{c.item.id}</span>
                {c.item.text}
              </p>
              <p className="text-[11px] text-ink-faint">
                {c.item.auto ? `Automatic check: ${c.detail}` : c.detail}
                {c.item.usesAlternative && <span className="ml-1 text-level-caution">· Alternative step: {c.item.missingEquipment} unavailable</span>}
              </p>
            </div>
            {!c.item.auto && active && (
              <Button size="sm" variant={c.done ? "ghost" : "secondary"} onClick={() => dispatch({ type: "eva/check", itemId: c.item.id })} data-testid={`eva-check-${c.item.id}`}>
                {c.done ? "Undo" : "Confirm"}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DecisionInputs({ by, setBy, reason, setReason, reasonLabel }: { by: string; setBy: (v: string) => void; reason: string; setReason: (v: string) => void; reasonLabel: string }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <Field label="Decided by">
        <input className={inputClass} value={by} onChange={(e) => setBy(e.target.value)} />
      </Field>
      <Field label={reasonLabel}>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} data-testid="eva-reason" />
      </Field>
    </div>
  );
}

function PrePhase({ session }: { session: EvaSession }) {
  const { state, dispatch } = useFuture();
  const ctx = useEvaContext();
  const [by, setBy] = useState("Commander");
  const [reason, setReason] = useState("");
  const items = checklistStatus("pre", session, state.eva.equipment, ctx);
  const { proposal, reasons } = gateProposal(session, state.eva.equipment, ctx);
  return (
    <div className="space-y-3">
      <Checklist items={items} phase="pre" active />
      <div className={cx("rounded-lg border p-3", proposal === "go" ? "border-level-nominal/40 bg-level-nominal/5" : "border-level-caution/40 bg-level-caution/5")}>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">System proposal · {EVA_PROTOCOL_REF}</p>
        <p className={cx("text-lg font-bold", proposal === "go" ? "text-level-nominal" : "text-level-caution")} data-testid="eva-proposal">
          {proposal === "go" ? "GO" : "HOLD"}
        </p>
        {reasons.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-ink-muted">
            {reasons.map((r) => (
              <li key={r}>• {r}</li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-ink-faint">A procedural readiness proposal — not a medical clearance. The commander decides; deciding against the proposal requires a reason.</p>
      </div>
      <DecisionInputs by={by} setBy={setBy} reason={reason} setReason={setReason} reasonLabel="Reason (required to override)" />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          disabled={proposal !== "go" && !reason.trim()}
          onClick={() => dispatch({ type: "eva/gate", decision: "go", by, reason })}
          data-testid="eva-go"
        >
          Decide GO {proposal !== "go" && "(override)"}
        </Button>
        <Button
          disabled={proposal !== "hold" && !reason.trim()}
          onClick={() => dispatch({ type: "eva/gate", decision: "hold", by, reason })}
          data-testid="eva-hold"
        >
          Decide HOLD {proposal !== "hold" && "(override)"}
        </Button>
        <Button variant="ghost" disabled={!reason.trim()} onClick={() => dispatch({ type: "eva/cancel", by, reason })} data-testid="eva-cancel">
          Cancel EVA
        </Button>
      </div>
    </div>
  );
}

function EventCard({ rec }: { rec: EvaSession["events"][number] }) {
  const { dispatch } = useFuture();
  const [by, setBy] = useState("Commander");
  const [reason, setReason] = useState("");
  return (
    <li className="rounded-lg border border-level-caution/40 bg-level-caution/5 p-3" data-testid={`eva-event-${rec.eventId}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-level-caution">{rec.label}</p>
        <span className="text-[11px] text-ink-faint">
          {rec.id} · {formatMissionTime(rec.at)}
        </span>
      </div>
      <ol className="mt-1.5 list-decimal space-y-0.5 pl-5 text-xs text-ink">
        {rec.steps.map((s) => (
          <li key={s.id}>
            {s.text}
            {s.usesAlternative && <span className="ml-1 text-level-caution">(alternative — {s.missingEquipment} unavailable)</span>}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-ink-muted">
        System proposal: <strong className="text-ink">{rec.proposal === "terminate" ? "END the EVA" : "CONTINUE"}</strong> (demonstration protocol)
      </p>
      {rec.decision ? (
        <p className="mt-1 text-xs text-ink-muted" data-testid="eva-event-decision">
          Decision: <strong className="text-ink">{rec.decision.choice === "terminate" ? "End EVA" : "Continue"}</strong> by {rec.decision.by}
          {rec.decision.override ? ` — override: “${rec.decision.reason}”` : " (as proposed)"}
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <DecisionInputs by={by} setBy={setBy} reason={reason} setReason={setReason} reasonLabel="Reason (required to override)" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={rec.proposal !== "continue" && !reason.trim()}
              onClick={() => dispatch({ type: "eva/decide", recordId: rec.id, choice: "continue", by, reason })}
              data-testid="event-continue"
            >
              Continue EVA
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={rec.proposal !== "terminate" && !reason.trim()}
              onClick={() => dispatch({ type: "eva/decide", recordId: rec.id, choice: "terminate", by, reason })}
              data-testid="event-terminate"
            >
              End EVA
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function SessionPanel({ session }: { session: EvaSession }) {
  const { state, dispatch } = useFuture();
  const ctx = useEvaContext();
  const [by, setBy] = useState("Commander");
  const [reason, setReason] = useState("");
  const phaseIndex = PHASES.findIndex((p) => p.id === session.phase);
  const postItems = checklistStatus("post", session, state.eva.equipment, ctx);
  const openPost = postItems.filter((c) => !c.done).length;

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-1.5" aria-label="EVA phase" data-testid="eva-phase">
        {PHASES.map((p, i) => (
          <li
            key={p.id}
            aria-current={p.id === session.phase ? "step" : undefined}
            className={cx(
              "rounded-md border px-2.5 py-1 text-xs",
              p.id === session.phase ? "border-accent/60 bg-accent/15 font-semibold text-accent" : i < phaseIndex ? "border-level-nominal/30 text-level-nominal" : "border-line text-ink-faint",
            )}
          >
            {p.label}
          </li>
        ))}
      </ol>
      <p className="text-xs text-ink-muted">
        {session.id} · {session.crew.map(crewName).join(" & ")} · planned {formatMissionTime(session.plannedAt)}
        {session.startedAt && ` · started ${formatMissionTime(session.startedAt)}`}
        {session.endedAt && ` · ended ${formatMissionTime(session.endedAt)}`}
      </p>

      {session.phase === "pre" && <PrePhase session={session} />}

      {session.phase === "during" && (
        <div className="space-y-3">
          <Checklist items={checklistStatus("during", session, state.eva.equipment, ctx)} phase="during" active />
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Simulate an event</p>
            <div className="flex flex-wrap gap-2">
              {EVA_PROTOCOL.events.map((e) => (
                <Button key={e.id} size="sm" variant="secondary" icon={AlertTriangle} onClick={() => dispatch({ type: "eva/event", eventId: e.id })} data-testid={`eva-raise-${e.id}`}>
                  {e.label}
                </Button>
              ))}
            </div>
          </div>
          <Button variant="primary" onClick={() => dispatch({ type: "eva/end" })} data-testid="eva-end">
            End EVA normally
          </Button>
        </div>
      )}

      {session.phase === "post" && (
        <div className="space-y-3">
          <Checklist items={postItems} phase="post" active />
          <div className="flex flex-wrap gap-2">
            <Button disabled={session.logQueued} onClick={() => dispatch({ type: "eva/queue-log" })} data-testid="eva-queue-log">
              {session.logQueued ? "EVA log queued" : "Queue EVA log to Earth"}
            </Button>
          </div>
          <DecisionInputs by={by} setBy={setBy} reason={reason} setReason={setReason} reasonLabel={openPost ? "Reason (required: post-EVA items open)" : "Note (optional)"} />
          <Button variant="primary" disabled={openPost > 0 && !reason.trim()} onClick={() => dispatch({ type: "eva/close", by, reason })} data-testid="eva-close">
            Close EVA
          </Button>
        </div>
      )}

      {session.events.length > 0 && (
        <ul className="space-y-2">
          {[...session.events].reverse().map((rec) => (
            <EventCard key={rec.id} rec={rec} />
          ))}
        </ul>
      )}
    </div>
  );
}

function PlanForm() {
  const { dispatch } = useFuture();
  const [crew, setCrew] = useState<CrewId[]>(["crew-a", "crew-c"]);
  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink-muted">EVA crew (choose two)</legend>
        <div className="flex flex-wrap gap-2">
          {CREW.map((c) => (
            <label key={c.id} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                checked={crew.includes(c.id)}
                onChange={() => setCrew((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]))}
                data-testid={`eva-crew-${c.id}`}
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>
      <Button variant="primary" icon={Rocket} disabled={crew.length !== 2} onClick={() => dispatch({ type: "eva/plan", crew })} data-testid="eva-plan">
        Plan EVA
      </Button>
    </div>
  );
}

function DecisionHistory() {
  const { state } = useFuture();
  const sessions = [...state.eva.history, ...(state.eva.session ? [state.eva.session] : [])];
  const rows = sessions.flatMap((s) => [
    ...s.gates.map((g, i) => ({
      key: `${s.id}-g${i}`,
      at: g.decision.at,
      what: `${s.id} pre-EVA gate`,
      proposal: g.proposal.toUpperCase(),
      decision: g.decision.choice.toUpperCase(),
      by: g.decision.by,
      override: g.decision.override,
      reason: g.decision.reason,
    })),
    ...s.events
      .filter((e) => e.decision)
      .map((e) => ({
        key: e.id,
        at: e.decision!.at,
        what: `${s.id} · ${e.label}`,
        proposal: e.proposal === "terminate" ? "END" : "CONTINUE",
        decision: e.decision!.choice === "terminate" ? "END" : "CONTINUE",
        by: e.decision!.by,
        override: e.decision!.override,
        reason: e.decision!.reason,
      })),
  ]);
  if (!rows.length) return <EmptyState>No EVA decisions yet.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs" data-testid="eva-decisions">
        <thead className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-faint">
          <tr>
            <th className="px-2 py-1.5">Time</th>
            <th className="px-2 py-1.5">Decision point</th>
            <th className="px-2 py-1.5">Proposal</th>
            <th className="px-2 py-1.5">Decision</th>
            <th className="px-2 py-1.5">By</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line/50 text-ink-muted">
              <td className="px-2 py-1.5 font-mono">{formatMissionTime(r.at)}</td>
              <td className="px-2 py-1.5 text-ink">{r.what}</td>
              <td className="px-2 py-1.5">{r.proposal}</td>
              <td className="px-2 py-1.5">
                {r.decision}
                {r.override && <Badge tone="caution" className="ml-1">override</Badge>}
                {r.reason && <span className="block text-[11px] text-ink-faint">“{r.reason}”</span>}
              </td>
              <td className="px-2 py-1.5">{r.by}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EvaView() {
  const { state, dispatch } = useFuture();
  const session = state.eva.session;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">FUTURE 04 · EVA &amp; Autonomous Response</h1>
        <p className="text-sm text-ink-muted">Pre / during / post-EVA checklists, equipment-conditioned response steps, logged crew decisions — with or without the Earth link.</p>
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title={session ? `EVA ${session.id}` : "Plan an EVA"} icon={ClipboardCheck} className="xl:col-span-2" eyebrow={`Protocol ${EVA_PROTOCOL_REF} · ${EVA_PROTOCOL.status}`}>
          {session ? <SessionPanel session={session} /> : <PlanForm />}
        </Panel>
        <div className="space-y-4">
          <Panel title="Equipment availability" icon={Wrench} eyebrow="Demonstration assumption">
            <ul className="space-y-1.5">
              {EVA_PROTOCOL.equipment.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-ink">{e.label}</span>
                  <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <input
                      type="checkbox"
                      checked={state.eva.equipment[e.id]}
                      onChange={(ev) => dispatch({ type: "eva/set-equipment", equipmentId: e.id, available: ev.target.checked })}
                      data-testid={`equip-${e.id}`}
                    />
                    {state.eva.equipment[e.id] ? "Available" : "Unavailable"}
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-ink-faint">Steps that need unavailable equipment switch to their alternative text, and the switch is logged.</p>
          </Panel>
          <Panel title="Protocol basis" icon={Gavel}>
            <Note tone="caution">{EVA_PROTOCOL.provenance}</Note>
            <div className="mt-2 space-y-1 text-[11px]">
              <p className="text-ink-faint">Context (official NASA HRP risks, association chosen by the team):</p>
              {EVA_PROTOCOL.refIds.map((id) => (
                <div key={id}>
                  <ReferenceLink refId={id} compact />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-faint">
              Event priorities for Earth Link:{" "}
              {EVA_PROTOCOL.events.map((e) => (
                <Badge key={e.id} tone={PRIORITY_TONE[e.priority]} className="mr-1 mt-1">
                  {e.id.replace("EV-", "")} · {e.priority}
                </Badge>
              ))}
            </p>
          </Panel>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Decision history" icon={History}>
          <DecisionHistory />
        </Panel>
        <OutboxPanel filterModule="F04" />
      </div>
    </div>
  );
}
