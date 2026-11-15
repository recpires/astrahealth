"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Activity, BookOpen, Brain, ClipboardCheck, Pause, Play, RadioTower, Rocket, type LucideIcon } from "lucide-react";
import { useMission } from "@/state/MissionProvider";
import { Badge, DemoTag, cx } from "@/components/ui/primitives";
import { LEVEL_TEXT, LEVEL_TONE, URGENCY_TONE, type ToneName } from "@/components/ui/levels";
import { TIME_SCALES, isPlaybackComplete } from "@/lib/mission/reducer";
import { messageStatus } from "@/lib/comms/queue";
import { formatMET } from "@/lib/time";
import { AstraLogo } from "@/components/layout/AstraLogo";
import { EVIDENCE_LIBRARY } from "@/config/evidence-library";

interface NavItem {
  href: string;
  step?: string;
  verb?: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/", step: "01", verb: "Measure", label: "Monitoring", icon: Activity },
  { href: "/analysis", step: "02", verb: "Understand", label: "Analysis", icon: Brain },
  { href: "/response", step: "03", verb: "Act", label: "Response", icon: ClipboardCheck },
  { href: "/comms", step: "04", verb: "Communicate", label: "Earth Link", icon: RadioTower },
  { href: "/science", label: "Science & Limits", icon: BookOpen },
  { href: "/future", label: "Platform preview", icon: Rocket },
];

function useNavStatus(): Record<string, { tone: ToneName; text: string } | null> {
  const { state, view } = useMission();
  const sensorsOff = Object.values(view.effective.sensors).filter((s) => s.status !== "online").length;
  const inFlight = state.comms.messages.filter((m) => messageStatus(m, state.clock).state !== "response-received").length;
  return {
    "/": sensorsOff ? { tone: "sensor", text: `${sensorsOff} sensor${sensorsOff > 1 ? "s" : ""}` } : { tone: "nominal", text: "Live" },
    "/analysis": { tone: LEVEL_TONE[view.effective.level], text: LEVEL_TEXT[view.effective.level] },
    "/response": view.support.required
      ? { tone: URGENCY_TONE[view.support.urgency], text: "Support" }
      : view.effective.findings.length
        ? { tone: "advisory", text: "Open" }
        : null,
    "/comms": inFlight ? { tone: "accent", text: `${inFlight} in flight` } : null,
    "/science": { tone: "nominal", text: `${EVIDENCE_LIBRARY.length} NASA refs` },
    "/future": { tone: "neutral", text: "F01–F05" },
  };
}

function Header() {
  const { state, view, dispatch } = useMission();
  const complete = isPlaybackComplete(state);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-space-950/90 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 lg:px-6">
        <Link href="/" className="flex items-center gap-3" aria-label="ASTRA Health home">
          <AstraLogo size={44} />
          <div className="leading-tight">
            <p className="text-base font-bold tracking-[0.2em] text-ink">
              ASTRA <span className="text-accent">HEALTH</span>
            </p>
            <p className="hidden text-[10px] uppercase tracking-[0.16em] text-ink-faint sm:block">
              Autonomous Space Health Response Assistant
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-3 rounded-lg border border-line bg-space-900/80 px-3 py-1.5">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Mission elapsed (sim)</p>
            <p className="tabular font-mono text-sm font-semibold text-ink" data-testid="met-clock">
              {formatMET(state.clock)}
            </p>
          </div>
          <div className="hidden h-8 w-px bg-line sm:block" />
          <div className="hidden sm:block">
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-ink-faint">Scenario</p>
            <p className="text-sm font-medium text-ink">
              {view.scenario.shortName}
              {complete && <span className="ml-2 text-xs text-ink-faint">(recording ended)</span>}
            </p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Badge tone={LEVEL_TONE[view.effective.level]} pulse={view.effective.level === "WARNING"} title="Overall attention level">
            {LEVEL_TEXT[view.effective.level]}
          </Badge>
          <DemoTag label="Simulated data · Demo" />
          <div className="flex items-center rounded-lg border border-line bg-space-900/80 p-0.5" role="group" aria-label="Simulation speed">
            <button
              type="button"
              onClick={() => dispatch({ type: "SET_RUNNING", running: !state.running })}
              className="rounded-md p-1.5 text-ink-muted hover:bg-space-800 hover:text-ink"
              aria-label={state.running ? "Pause simulation" : "Resume simulation"}
            >
              {state.running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            {TIME_SCALES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => dispatch({ type: "SET_TIME_SCALE", timeScale: s })}
                aria-pressed={state.timeScale === s}
                className={cx(
                  "tabular rounded-md px-2 py-1 font-mono text-xs",
                  state.timeScale === s ? "bg-accent/15 text-accent" : "text-ink-muted hover:text-ink",
                )}
              >
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>
    </header>
  );
}

function Nav() {
  const pathname = usePathname();
  const status = useNavStatus();
  return (
    <nav aria-label="Modules" className="border-b border-line bg-space-950/60 md:border-b-0 md:border-r">
      <ul className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible md:p-3">
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href === "/future" && pathname.startsWith("/future/"));
          const st = status[item.href];
          const Icon = item.icon;
          return (
            <li key={item.href} className={cx(item.href === "/science" && "md:mt-4 md:border-t md:border-line md:pt-4")}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "group flex min-w-[9.5rem] items-start gap-3 rounded-lg border px-3 py-2 transition-colors md:min-w-0",
                  active ? "border-accent/50 bg-accent/10" : "border-transparent hover:border-line hover:bg-space-900",
                )}
              >
                <Icon aria-hidden className={cx("mt-1 h-4 w-4 shrink-0", active ? "text-accent" : "text-ink-faint group-hover:text-ink-muted")} />
                <span className="min-w-0 flex-1 leading-tight">
                  {item.step && (
                    <span className="block whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
                      {item.step} · {item.verb}
                    </span>
                  )}
                  <span className={cx("block text-sm font-medium", active ? "text-ink" : "text-ink-muted group-hover:text-ink")}>
                    {item.label}
                  </span>
                  {st && (
                    <Badge tone={st.tone} className="mt-1 hidden md:inline-flex">
                      {st.text}
                    </Badge>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden px-4 pb-4 md:block">
        <p className="rounded-lg border border-dashed border-line p-3 text-[11px] leading-relaxed text-ink-faint">
          MEASURE → UNDERSTAND → ACT → COMMUNICATE. All readings are simulated. ASTRA Health gives no diagnosis or treatment.
        </p>
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="md:sticky md:top-[61px] md:h-[calc(100vh-61px)] md:overflow-y-auto md:w-56 md:shrink-0 xl:w-60">
          <Nav />
        </div>
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
      <footer className="border-t border-line px-4 py-3 text-[11px] text-ink-faint lg:px-6">
        <p>
          ASTRA Health · Team ANGARIS · NASA Space Apps Challenge 2026 · Demonstration prototype — not a medical device, not
          clinically validated, simulated data only. Code and content developed with AI assistance (see{" "}
          <Link href="/science" className="text-accent hover:underline">
            Science &amp; Limits
          </Link>
          ).
        </p>
      </footer>
    </div>
  );
}
