"use client";

import { useState } from "react";
import { Earth, FileText, Inbox, MessageSquarePlus, Orbit, RadioTower, Send, Timer, Wifi, WifiOff } from "lucide-react";
import {
  DELAY_PRESETS,
  MAX_ONE_WAY_DELAY_MIN,
  MIN_ONE_WAY_DELAY_MIN,
  lightTravelDistanceKm,
  roundTripMinutes,
} from "@/lib/comms/delay";
import {
  GROUND_HANDLING_SEC,
  STATE_LABEL,
  TX_DURATION_SEC,
  messageStatus,
  messageTimeline,
  simulatedAcknowledgement,
  type LinkMessage,
  type MessagePriority,
  type MessageState,
} from "@/lib/comms/queue";
import { buildReportFromState } from "@/lib/mission/reducer";
import { reportToText, type IncidentReport } from "@/lib/report/incident-report";
import { formatDuration, formatMET } from "@/lib/time";
import { useMission } from "@/state/MissionProvider";
import { Badge, Button, DemoTag, EmptyState, Panel, ProgressBar, cx } from "@/components/ui/primitives";
import { LEVEL_TONE, MESSAGE_TONE, TONES, type ToneName } from "@/components/ui/levels";

const STEPS: MessageState[] = ["queued", "sent", "received", "response-pending", "response-received"];
const STEP_SHORT: Record<MessageState, string> = {
  queued: "Awaiting send",
  sent: "Sent",
  received: "Received",
  "response-pending": "Response pending",
  "response-received": "Response in",
};

const PRIORITY_TONE: Record<MessagePriority, ToneName> = { routine: "neutral", priority: "caution", urgent: "warning" };

function DelayPanel() {
  const { state, dispatch } = useMission();
  const d = state.comms.oneWayDelayMin;
  const realRoundTripSec = (roundTripMinutes(d) * 60) / state.timeScale;
  return (
    <Panel title="Signal delay (simulated)" eyebrow="Earth ↔ Mars" icon={Timer} actions={<DemoTag label="Simulation" />}>
      <label htmlFor="delay" className="flex items-baseline justify-between text-sm text-ink-muted">
        One-way delay
        <span className="tabular font-mono text-2xl font-semibold text-ink" data-testid="one-way-delay">
          {d} min
        </span>
      </label>
      <input
        id="delay"
        type="range"
        min={MIN_ONE_WAY_DELAY_MIN}
        max={MAX_ONE_WAY_DELAY_MIN}
        step={1}
        value={d}
        onChange={(e) => dispatch({ type: "SET_DELAY", minutes: Number(e.target.value) })}
        className="astra-range mt-2 w-full"
        aria-label="One-way signal delay in minutes"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>{MIN_ONE_WAY_DELAY_MIN} min</span>
        <span>{MAX_ONE_WAY_DELAY_MIN} min</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {DELAY_PRESETS.map((p) => (
          <Button key={p.label} size="sm" variant={d === p.minutes ? "primary" : "secondary"} onClick={() => dispatch({ type: "SET_DELAY", minutes: p.minutes })}>
            {p.label} · {p.minutes} min
          </Button>
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-line bg-space-850/60 p-3">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Round trip (min.)</dt>
          <dd className="tabular font-mono text-xl text-accent" data-testid="round-trip">
            {roundTripMinutes(d)} min
          </dd>
          <dd className="text-[11px] text-ink-faint">+ ground response time</dd>
        </div>
        <div className="rounded-lg border border-line bg-space-850/60 p-3">
          <dt className="text-[10px] uppercase tracking-[0.16em] text-ink-faint">Light-travel distance</dt>
          <dd className="tabular font-mono text-xl text-ink">{(lightTravelDistanceKm(d) / 1e6).toFixed(0)} M km</dd>
          <dd className="text-[11px] text-ink-faint">delay × speed of light</dd>
        </div>
      </dl>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-space-850/60 p-3">
        <div className="flex items-center gap-2 text-sm">
          {state.comms.linkUp ? <Wifi className="h-4 w-4 text-level-nominal" /> : <WifiOff className="h-4 w-4 text-level-warning" />}
          <span className="text-ink">Link {state.comms.linkUp ? "available" : "unavailable"}</span>
        </div>
        <Button size="sm" variant={state.comms.linkUp ? "secondary" : "primary"} onClick={() => dispatch({ type: "SET_LINK", up: !state.comms.linkUp })}>
          {state.comms.linkUp ? "Simulate outage" : "Restore link"}
        </Button>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
        Simulation only — no real spacecraft connection. The 3–22 min range comes from the team brief. Time runs {state.timeScale}× faster
        than real time, so a {roundTripMinutes(d)} min round trip takes about {formatDuration(realRoundTripSec)} of real time. Each
        message occupies the transmitter for {TX_DURATION_SEC} s; the simulated ground replies {formatDuration(GROUND_HANDLING_SEC)} after
        receipt.
      </p>
    </Panel>
  );
}

function LinkDiagram() {
  const { state } = useMission();
  const pips = state.comms.messages
    .map((m) => ({ m, st: messageStatus(m, state.clock) }))
    .filter(({ st }) => st.state === "sent" || st.state === "response-pending");
  return (
    <Panel title="Link view" eyebrow="Messages in transit" icon={Orbit}>
      <div className="relative flex items-center justify-between px-2 py-6">
        <div className="z-10 flex flex-col items-center gap-1">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-[#f97316]/50 bg-gradient-to-br from-[#c2410c] to-[#7c2d12] shadow-[0_0_24px_rgba(249,115,22,0.35)]">
            <Orbit className="h-6 w-6 text-orange-100" />
          </span>
          <span className="text-xs font-semibold text-ink">Mars vehicle</span>
          <span className="text-[10px] text-ink-faint">crew</span>
        </div>
        <div className="absolute inset-x-20 top-1/2 h-px -translate-y-3 border-t border-dashed border-line-strong" aria-hidden />
        {pips.map(({ m, st }) => {
          const p = st.progress ?? 0;
          const toEarth = st.state === "sent";
          const left = toEarth ? p : 1 - p;
          return (
            <span
              key={m.id}
              className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-[calc(50%+12px)]"
              style={{ left: `calc(7rem + (100% - 14rem) * ${left})` }}
              title={`${m.id} — ${st.label}`}
            >
              <span className={cx("block rounded-full border px-1.5 py-0.5 font-mono text-[10px]", toEarth ? "border-accent/60 bg-accent/20 text-accent" : "border-level-caution/60 bg-level-caution/20 text-level-caution")}>
                {toEarth ? `${m.id} →` : `← ACK ${m.id}`}
              </span>
            </span>
          );
        })}
        <div className="z-10 flex flex-col items-center gap-1">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-sky-400/50 bg-gradient-to-br from-sky-600 to-blue-900 shadow-[0_0_24px_rgba(56,189,248,0.35)]">
            <Earth className="h-6 w-6 text-sky-100" />
          </span>
          <span className="text-xs font-semibold text-ink">Earth</span>
          <span className="text-[10px] text-ink-faint">mission control (sim)</span>
        </div>
      </div>
      {pips.length === 0 && <p className="text-center text-xs text-ink-faint">No message in transit.</p>}
    </Panel>
  );
}

function ReportComposer() {
  const { state, view, dispatch } = useMission();
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [tab, setTab] = useState<"text" | "json">("text");
  const [note, setNote] = useState("");
  const defaultPriority: MessagePriority = view.support.urgency === "urgent" ? "urgent" : view.support.required ? "priority" : "routine";
  const [priority, setPriority] = useState<MessagePriority | null>(null);
  const effectivePriority = priority ?? defaultPriority;

  const generate = () => {
    const r = buildReportFromState(state, view);
    setReport(r);
    dispatch({ type: "LOG_ACTION", kind: "comms", text: `Incident report ${r.reportId} generated` });
  };

  const queue = () => {
    if (!report) return;
    dispatch({
      type: "QUEUE_MESSAGE",
      kind: "incident-report",
      subject: `Incident report ${report.reportId} — ${report.assessment.attentionLevel}`,
      body: reportToText(report),
      priority: effectivePriority,
      report,
    });
    setReport(null);
    setPriority(null);
  };

  const sendNote = () => {
    const text = note.trim();
    if (!text) return;
    dispatch({ type: "QUEUE_MESSAGE", kind: "crew-note", subject: "Crew note", body: text, priority: "routine" });
    setNote("");
  };

  return (
    <Panel
      title="Structured incident report"
      eyebrow={`Format ASTRA-IR/0.1`}
      icon={FileText}
      actions={
        <Button size="sm" variant="primary" icon={FileText} onClick={generate} data-testid="generate-report">
          {report ? "Regenerate" : "Generate report"}
        </Button>
      }
    >
      {!report ? (
        <EmptyState>
          Generate a report to snapshot the current assessment, findings, confirmations, actions and medical-support status.
        </EmptyState>
      ) : (
        <div data-testid="report-preview">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{report.reportId}</Badge>
            <Badge tone={LEVEL_TONE[report.assessment.attentionLevel]}>{report.assessment.attentionLevel}</Badge>
            <span className="tabular font-mono text-[11px] text-ink-faint">{report.generatedAt}</span>
            <div className="ml-auto flex rounded-md border border-line p-0.5 text-xs">
              {(["text", "json"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={cx("rounded px-2 py-0.5 uppercase", tab === t ? "bg-accent/15 text-accent" : "text-ink-muted")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-space-950/80 p-3 font-mono text-[11px] leading-relaxed text-ink-muted">
            {tab === "text" ? reportToText(report) : JSON.stringify(report, null, 2)}
          </pre>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="text-xs text-ink-muted" htmlFor="priority">
              Priority
            </label>
            <select
              id="priority"
              value={effectivePriority}
              onChange={(e) => setPriority(e.target.value as MessagePriority)}
              className="rounded-md border border-line bg-space-850 px-2 py-1 text-sm text-ink"
            >
              <option value="routine">Routine</option>
              <option value="priority">Priority</option>
              <option value="urgent">Urgent</option>
            </select>
            <Button variant={effectivePriority === "urgent" ? "danger" : "primary"} icon={Send} onClick={queue} data-testid="queue-report" className="ml-auto">
              Queue for transmission
            </Button>
          </div>
        </div>
      )}
      <div className="mt-4 border-t border-line pt-4">
        <label htmlFor="note" className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-faint">
          Short crew note
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendNote()}
            placeholder="e.g. Sensor re-seated, monitoring continues"
            className="min-w-0 flex-1 rounded-md border border-line bg-space-850 px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint"
          />
          <Button icon={MessageSquarePlus} onClick={sendNote} disabled={!note.trim()}>
            Queue
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function StateStepper({ state }: { state: MessageState }) {
  const idx = STEPS.indexOf(state);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={`Status: ${STATE_LABEL[state]}`}>
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1">
          <span
            className={cx(
              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
              i < idx && "text-ink-faint",
              i === idx && cx(TONES[MESSAGE_TONE[s]].bg, TONES[MESSAGE_TONE[s]].text, "border", TONES[MESSAGE_TONE[s]].border),
              i > idx && "text-ink-faint/50",
            )}
          >
            {STEP_SHORT[s]}
          </span>
          {i < STEPS.length - 1 && <span className="text-ink-faint/50">›</span>}
        </li>
      ))}
    </ol>
  );
}

function MessageRow({ m }: { m: LinkMessage }) {
  const { state } = useMission();
  const st = messageStatus(m, state.clock);
  const tl = messageTimeline(m);
  const remaining = st.nextChangeAt !== null ? st.nextChangeAt - state.clock : null;
  return (
    <li className="rounded-lg border border-line bg-space-850/60 p-3" data-testid={`message-${m.id}`} data-state={st.state}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-accent">{m.id}</span>
        <Badge tone={PRIORITY_TONE[m.priority]}>{m.priority}</Badge>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{m.subject}</span>
        <Badge tone={MESSAGE_TONE[st.state]} pulse={st.state !== "response-received"}>
          {st.label}
        </Badge>
      </div>
      <div className="mt-2">
        <StateStepper state={st.state} />
      </div>
      {st.progress !== null && st.state !== "response-received" && (
        <div className="mt-2 flex items-center gap-3">
          <ProgressBar value={st.progress} tone={MESSAGE_TONE[st.state]} label={`${m.id} progress`} />
          {remaining !== null && <span className="tabular shrink-0 font-mono text-[11px] text-ink-faint">next in {formatDuration(remaining)}</span>}
        </div>
      )}
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[10px] text-ink-faint sm:grid-cols-5">
        <div>queued {formatMET(tl.createdAt)}</div>
        <div>sent {tl.sentAt !== null ? formatMET(tl.sentAt) : "—"}</div>
        <div>at Earth {tl.receivedAt !== null ? formatMET(tl.receivedAt) : "—"}</div>
        <div>reply sent {tl.replySentAt !== null ? formatMET(tl.replySentAt) : "—"}</div>
        <div>reply in {tl.replyReceivedAt !== null ? formatMET(tl.replyReceivedAt) : "—"}</div>
      </dl>
      {st.state === "response-received" && (
        <p className="mt-2 flex gap-2 rounded-md border border-level-nominal/40 bg-level-nominal/5 px-3 py-2 text-xs text-ink-muted">
          <Inbox className="h-4 w-4 shrink-0 text-level-nominal" />
          {simulatedAcknowledgement(m)}
        </p>
      )}
      {m.oneWayDelaySec !== null && (
        <p className="mt-1 text-[10px] text-ink-faint">One-way delay locked at transmission: {formatDuration(m.oneWayDelaySec)}</p>
      )}
    </li>
  );
}

function QueuePanel() {
  const { state } = useMission();
  const messages = [...state.comms.messages].reverse();
  const counts = STEPS.map((s) => ({ s, n: state.comms.messages.filter((m) => messageStatus(m, state.clock).state === s).length }));
  return (
    <Panel title="Transmission queue & message history" eyebrow="Outbound to Earth" icon={RadioTower}>
      <div className="mb-3 flex flex-wrap gap-2">
        {counts.map(({ s, n }) => (
          <Badge key={s} tone={n ? MESSAGE_TONE[s] : "neutral"} className={n ? "" : "opacity-50"}>
            {STEP_SHORT[s]} · {n}
          </Badge>
        ))}
      </div>
      {messages.length === 0 ? (
        <EmptyState>No messages yet. Generate an incident report and queue it for transmission.</EmptyState>
      ) : (
        <ul className="space-y-2" data-testid="message-list">
          {messages.map((m) => (
            <MessageRow key={m.id} m={m} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function CommsView() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">04 · Communicate</p>
          <h1 className="text-2xl font-semibold text-ink">Earth link simulator</h1>
        </div>
        <p className="max-w-xl text-xs text-ink-faint">
          Simulated Earth–Mars messaging with configurable signal delay. It does not represent a real spacecraft connection; replies
          are automatic placeholders.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <DelayPanel />
        <div className="flex flex-col gap-4 xl:col-span-2">
          <LinkDiagram />
          <ReportComposer />
        </div>
      </div>
      <QueuePanel />
    </div>
  );
}
