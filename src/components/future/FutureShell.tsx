"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Clock, HardDrive, RadioTower, RotateCcw, WifiOff } from "lucide-react";
import { Badge, Button, DemoTag, cx } from "@/components/ui/primitives";
import { FutureProvider, useFuture } from "@/features/platform/FutureProvider";
import { pendingCount } from "@/features/platform/earth-link";
import { formatMissionTime } from "@/features/platform/time";
import { DELAY_PRESETS } from "@/lib/comms/delay";

export const FUTURE_TABS = [
  { href: "/future", code: "Hub", label: "Overview" },
  { href: "/future/journal", code: "F01", label: "Health Journal" },
  { href: "/future/assess", code: "F02", label: "Symptom Assessment" },
  { href: "/future/profile", code: "F03", label: "Space Health Profile" },
  { href: "/future/eva", code: "F04", label: "EVA & Response" },
  { href: "/future/readiness", code: "F05", label: "Readiness & Trace" },
] as const;

function PlatformBar() {
  const { state, dispatch, ready, storageWritable, resetDemo } = useFuture();
  const [confirmReset, setConfirmReset] = useState(false);
  const { clock, link, outbox } = state.platform;
  const pending = pendingCount(outbox);
  const queued = outbox.filter((m) => m.state === "queued").length;

  return (
    <div className="rounded-xl border border-line bg-space-900/85 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-faint">ASTRA Health platform · FUTURE preview</p>
          <p className="text-sm font-semibold text-ink">Autonomous Space Health Decision Support</p>
        </div>
        <DemoTag label="Demonstration modules" />

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-space-950/60 px-2.5 py-1">
          <Clock aria-hidden className="h-4 w-4 text-accent" />
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Mission day (sim)</p>
            <p className="tabular font-mono text-sm font-semibold text-ink" data-testid="future-clock">
              {formatMissionTime(clock)}
            </p>
          </div>
          <div className="flex gap-1 whitespace-nowrap" role="group" aria-label="Advance mission time">
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "platform/advance", minutes: 15 })} data-testid="advance-15">
              +15 min
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "platform/advance", minutes: 60 })} data-testid="advance-60">
              +1 h
            </Button>
            <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "platform/next-day" })} data-testid="next-day">
              Next day
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-space-950/60 px-2.5 py-1">
          {link.available ? <RadioTower aria-hidden className="h-4 w-4 text-level-nominal" /> : <WifiOff aria-hidden className="h-4 w-4 text-level-warning" />}
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-faint">Earth link (sim)</p>
            <p className={cx("text-sm font-semibold", link.available ? "text-level-nominal" : "text-level-warning")} data-testid="link-status">
              {link.available ? "Available" : "LOST — working offline"}
            </p>
          </div>
          <Button
            size="sm"
            variant={link.available ? "secondary" : "primary"}
            onClick={() => dispatch({ type: "platform/set-link", available: !link.available })}
            data-testid="link-toggle"
          >
            {link.available ? "Simulate link loss" : "Restore link"}
          </Button>
          <label className="flex items-center gap-1 text-[11px] text-ink-faint">
            One-way
            <select
              aria-label="One-way delay"
              className="rounded border border-line bg-space-950 px-1 py-0.5 text-xs text-ink"
              value={link.oneWayDelayMin}
              onChange={(e) => dispatch({ type: "platform/set-delay", minutes: Number(e.target.value) })}
            >
              {DELAY_PRESETS.map((p) => (
                <option key={p.minutes} value={p.minutes}>
                  {p.minutes} min
                </option>
              ))}
            </select>
          </label>
          <Badge tone={queued ? "caution" : pending ? "accent" : "neutral"} title="Items not yet acknowledged by Earth">
            <span data-testid="outbox-count">{pending}</span> in queue
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint" data-testid="storage-status">
            <HardDrive aria-hidden className="h-3.5 w-3.5" />
            {!ready ? "Loading on-device data…" : storageWritable === false ? "Memory only (storage blocked)" : "Saved on this device"}
          </span>
          {confirmReset ? (
            <span className="flex items-center gap-1">
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  resetDemo();
                  setConfirmReset(false);
                }}
                data-testid="reset-confirm"
              >
                Erase local records
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
                Keep
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" icon={RotateCcw} onClick={() => setConfirmReset(true)} data-testid="reset-demo">
              Reset demo data
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModuleTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="FUTURE modules" className="-mx-1 overflow-x-auto">
      <ul className="flex min-w-max gap-1 px-1">
        {FUTURE_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  active ? "border-accent/50 bg-accent/10 text-ink" : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                )}
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">{t.code}</span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function FutureShell({ children }: { children: ReactNode }) {
  return (
    <FutureProvider>
      <div className="space-y-4">
        <PlatformBar />
        <ModuleTabs />
        {children}
      </div>
    </FutureProvider>
  );
}
