"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileSearch, ListTree, ShieldCheck, ShieldAlert, Users, XCircle } from "lucide-react";
import matrix from "@/data/future/verification-matrix.json";
import { Badge, Button, Panel, ScrollArea, cx } from "@/components/ui/primitives";
import type { ToneName } from "@/components/ui/levels";
import { Note } from "@/components/future/common";
import { useTelemetrySnapshot } from "@/components/future/ProfileView";
import { crewName } from "@/features/journal/config";
import { verifyAuditChain } from "@/features/platform/audit";
import { useFuture } from "@/features/platform/FutureProvider";
import { formatMissionTime } from "@/features/platform/time";
import { MODULE_LABEL, type AuditKind, type ModuleId } from "@/features/platform/types";
import { readinessSummary, ruleSets, systemVerification, type ReadinessStatus } from "@/features/readiness/logic";

const STATUS_TONE: Record<ReadinessStatus, ToneName> = { ok: "nominal", attention: "caution", missing: "warning" };
const OVERALL_TONE = { complete: "nominal", attention: "caution", incomplete: "warning" } as const;
const OVERALL_TEXT = { complete: "Data complete", attention: "Needs attention", incomplete: "Incomplete" } as const;
const KINDS: AuditKind[] = ["data", "decision", "action", "evidence", "sync", "system"];

export function ReadinessView() {
  const { state, storageWritable } = useFuture();
  const telemetry = useTelemetrySnapshot();
  const crew = useMemo(() => readinessSummary(state, telemetry), [state, telemetry]);
  const checks = systemVerification(state, { storageWritable });
  const sets = ruleSets();
  const [moduleFilter, setModuleFilter] = useState<ModuleId | "all">("all");
  const [kindFilter, setKindFilter] = useState<AuditKind | "all">("all");
  const [tamper, setTamper] = useState<string | null>(null);

  const audit = state.platform.audit.filter((a) => (moduleFilter === "all" || a.module === moduleFilter) && (kindFilter === "all" || a.kind === kindFilter));

  const exportTrace = () => {
    const payload = {
      exportedAt: state.platform.clock,
      application: "ASTRA Health — FUTURE modules (demonstration)",
      notice: "Simulated demonstration data. Rule sets are PROVISIONAL and not clinically validated.",
      ruleSets: sets,
      verification: checks,
      chain: verifyAuditChain(state.platform.audit),
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `astra-health-trace-day${state.platform.clock.day}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const runTamperTest = () => {
    const copy = state.platform.audit.map((e) => ({ ...e }));
    const target = copy[Math.floor(copy.length / 2)];
    if (!target) return;
    target.summary = `${target.summary} [edited]`;
    const r = verifyAuditChain(copy);
    setTamper(r.ok ? "Tampering NOT detected." : `Edited a copy of entry #${target.seq} → verification failed at entry #${r.brokenAtSeq}: ${r.reason}. The real trail was not changed.`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">FUTURE 05 · Verification &amp; Mission Readiness</h1>
        <p className="text-sm text-ink-muted">Is today&apos;s information complete and reviewed? Can every decision be traced back to its rule, evidence and inputs?</p>
      </div>

      <Panel title="Crew data & procedure readiness" icon={Users} eyebrow="Not a medical clearance or a fitness-for-duty decision">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {crew.map((c) => (
            <div key={c.crewId} className="rounded-lg border border-line p-3" data-testid={`readiness-${c.crewId}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{crewName(c.crewId)}</p>
                <Badge tone={OVERALL_TONE[c.overall]}>
                  <span data-testid={`readiness-overall-${c.crewId}`}>{OVERALL_TEXT[c.overall]}</span>
                </Badge>
              </div>
              <ul className="mt-2 space-y-1.5">
                {c.items.map((i) => (
                  <li key={i.id} className="text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATUS_TONE[i.status]}>{i.status}</Badge>
                      <span className="font-mono text-[10px] text-ink-faint">{i.module}</span>
                      <span className="text-ink">{i.label}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted">{i.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="System verification" icon={ShieldCheck}>
          <ul className="space-y-2" data-testid="verification-checks">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2" data-testid={`verify-${c.id}`}>
                {c.ok ? <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-level-nominal" /> : <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-level-warning" />}
                <div className="min-w-0">
                  <p className="text-sm text-ink">
                    <span className="mr-1 font-mono text-[10px] text-ink-faint">{c.id}</span>
                    {c.label} <span className={cx("text-xs font-semibold", c.ok ? "text-level-nominal" : "text-level-warning")} data-testid={`verify-result-${c.id}`}>{c.ok ? "PASS" : "ATTENTION"}</span>
                  </p>
                  <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" icon={ShieldAlert} onClick={runTamperTest} data-testid="tamper-test">
              Tamper test (on a copy)
            </Button>
            {tamper && (
              <span className="text-xs text-ink-muted" role="status" data-testid="tamper-result">
                {tamper}
              </span>
            )}
          </div>
        </Panel>

        <Panel title="Versioned rule sets & protocols" icon={ListTree}>
          <ScrollArea label="Versioned rule sets">
          <table className="w-full min-w-[420px] text-left text-xs" data-testid="rulesets">
            <thead className="border-b border-line text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="py-1.5 pr-2">Module</th>
                <th className="py-1.5 pr-2">Rule set @ version</th>
                <th className="py-1.5 pr-2">Status</th>
                <th className="py-1.5">Checksum</th>
              </tr>
            </thead>
            <tbody>
              {sets.map((r) => (
                <tr key={r.ref} className="border-b border-line/50">
                  <td className="py-1.5 pr-2 font-mono text-ink-faint">{r.module}</td>
                  <td className="py-1.5 pr-2 font-mono text-ink">{r.ref}</td>
                  <td className="py-1.5 pr-2">
                    <Badge tone="caution">{r.status}</Badge>
                  </td>
                  <td className="py-1.5 font-mono text-ink-faint">{r.checksum}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollArea>
          <h3 className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-ink-faint">Completion criteria — how they are verified</h3>
          <ul className="space-y-1.5 text-xs" data-testid="verification-matrix">
            {matrix.criteria.map((c) => (
              <li key={c.id}>
                <span className="font-mono text-ink-faint">{c.id}</span> <span className="text-ink">{c.criterion}</span>
                <p className="text-[11px] text-ink-muted [overflow-wrap:anywhere]">{c.how}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Traceability — audit trail"
        icon={FileSearch}
        eyebrow={`${state.platform.audit.length} entries · checksum-chained · stored on this device`}
        actions={
          <Button size="sm" icon={Download} onClick={exportTrace} data-testid="export-trace">
            Export JSON
          </Button>
        }
        bodyClassName="p-0"
      >
        <div className="flex flex-wrap gap-2 border-b border-line/70 px-4 py-2">
          <label className="text-xs text-ink-muted">
            Module{" "}
            <select className="ml-1 rounded border border-line bg-space-950 px-1 py-0.5 text-xs text-ink" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value as ModuleId | "all")} data-testid="audit-module">
              <option value="all">All</option>
              {(Object.keys(MODULE_LABEL) as ModuleId[]).map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABEL[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Kind{" "}
            <select className="ml-1 rounded border border-line bg-space-950 px-1 py-0.5 text-xs text-ink" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as AuditKind | "all")} data-testid="audit-kind">
              <option value="all">All</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div role="region" aria-label="Audit trail" tabIndex={0} className="max-h-[480px] overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent">
          <table className="w-full min-w-[820px] text-left text-xs" data-testid="audit-table">
            <thead className="sticky top-0 border-b border-line bg-space-900 text-[10px] uppercase tracking-[0.12em] text-ink-faint">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Module</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">What happened</th>
                <th className="px-3 py-2">Rule / evidence / record</th>
                <th className="px-3 py-2">Checksum</th>
              </tr>
            </thead>
            <tbody>
              {[...audit].reverse().map((a) => (
                <tr key={a.seq} className="border-b border-line/50 align-top text-ink-muted" data-testid="audit-row">
                  <td className="px-3 py-1.5 font-mono text-ink-faint">{a.seq}</td>
                  <td className="whitespace-nowrap px-3 py-1.5 font-mono">{formatMissionTime(a.at)}</td>
                  <td className="px-3 py-1.5">{a.module}</td>
                  <td className="px-3 py-1.5">{a.kind}</td>
                  <td className="px-3 py-1.5 text-ink">{a.summary}</td>
                  <td className="px-3 py-1.5 font-mono text-[10px]">
                    {[a.refs?.ruleSet, a.refs?.ruleIds?.join(","), a.refs?.evidenceIds?.join(","), a.refs?.recordId, a.refs?.inputChecksum && `in:${a.refs.inputChecksum}`]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-[10px] text-ink-faint">{a.hash.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Note>
        The checksum chain detects accidental or casual edits of the local record; it is not a security control. In a flight system the trail would be signed and
        replicated to the ground when the link allows.
      </Note>
    </div>
  );
}
