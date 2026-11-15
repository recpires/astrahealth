/**
 * Interface tests of the FUTURE modules (F01–F05) and the platform bar,
 * rendered with a frozen Monitoring simulation and the FUTURE store.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MissionProvider } from "@/state/MissionProvider";
import { createInitialState } from "@/lib/mission/reducer";
import { FutureProvider } from "@/features/platform/FutureProvider";
import { FutureShell } from "@/components/future/FutureShell";
import { JournalView } from "@/components/future/JournalView";
import { AssessView } from "@/components/future/AssessView";
import { ProfileView } from "@/components/future/ProfileView";
import { EvaView } from "@/components/future/EvaView";
import { ReadinessView } from "@/components/future/ReadinessView";
import { OverviewView } from "@/components/future/OverviewView";
import { STORAGE_PREFIX } from "@/features/platform/storage";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/future/journal" }));

function renderFuture(ui: ReactNode, { persist = false }: { persist?: boolean } = {}) {
  return render(
    <MissionProvider initialState={createInitialState()} autoTick={false}>
      <FutureProvider persist={persist}>{ui}</FutureProvider>
    </MissionProvider>,
  );
}

beforeEach(() => window.localStorage.clear());

describe("F01 · Health Journal", () => {
  it("shows the seed flags of Crew Member B and the overdue routines of Crew Member D", async () => {
    renderFuture(<JournalView />);
    await userEvent.click(screen.getByTestId("crew-crew-b"));
    expect(screen.getByTestId("flag-SHORT_SLEEP")).toHaveTextContent(/5 consecutive days/);
    expect(screen.getByTestId("flag-HIGH_FATIGUE")).toBeInTheDocument();
    await userEvent.click(screen.getByTestId("crew-crew-d"));
    expect(screen.getByTestId("flag-CHECKIN_MISSING")).toHaveTextContent(/days 12, 14/);
    expect(screen.getByTestId("routine-body-mass")).toHaveTextContent(/Overdue/);
  });

  it("validates and saves a check-in, then lists it as a crew entry", async () => {
    renderFuture(<JournalView />);
    await userEvent.click(screen.getByTestId("checkin-submit"));
    expect(screen.getByRole("alert")).toHaveTextContent(/Sleep must be between 0 and 24 hours/);
    await userEvent.type(screen.getByTestId("checkin-sleep"), "7.5");
    await userEvent.click(within(screen.getByTestId("checkin-fatigue")).getByText("4"));
    await userEvent.click(screen.getByTestId("checkin-symptom-headache"));
    await userEvent.click(screen.getByTestId("checkin-submit"));
    expect(screen.getByTestId("checkin-saved")).toHaveTextContent(/Saved for Crew Member A · Day 15 · 08:00/);
    const firstRow = within(screen.getByTestId("journal-history")).getAllByRole("row")[1];
    expect(firstRow).toHaveTextContent(/D15 08:00.*7.5 h.*4\/5.*Headache.*Crew entry/);
    expect(screen.getByTestId("flag-SYMPTOM_REPORTED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Update today's check-in/ })).toBeInTheDocument();
  });

  it("marks a routine done", async () => {
    renderFuture(<JournalView />);
    await userEvent.click(screen.getByTestId("routine-done-blood-pressure"));
    expect(screen.getByTestId("routine-blood-pressure")).toHaveTextContent(/Done today/);
  });
});

describe("F02 · Symptom Assessment", () => {
  it("runs the rules and shows steps, evidence, uncertainty and the human review", async () => {
    renderFuture(<AssessView />);
    await userEvent.selectOptions(screen.getByTestId("assess-symptom"), "dizziness");
    await userEvent.click(within(screen.getByTestId("assess-severity")).getByText("Severe"));
    await userEvent.click(screen.getByTestId("assess-submit"));
    expect(screen.getByTestId("assess-level")).toHaveTextContent("Medical support recommended");
    expect(screen.getByTestId("assess-steps")).toHaveTextContent(/Inform the crew medical officer/);
    expect(screen.getByTestId("assess-science")).toHaveTextContent(/Verified excerpts available/);
    expect(screen.getByTestId("assess-science")).toHaveTextContent(/Reference only/);
    expect(screen.getByTestId("assess-uncertainty")).toHaveTextContent("HIGH");
    expect(screen.getByTestId("review-override")).toBeDisabled();
    await userEvent.click(screen.getByTestId("review-accept"));
    expect(screen.getByTestId("assess-review-done")).toHaveTextContent(/Proposal accepted/);
    await userEvent.click(screen.getByTestId("assess-queue"));
    expect(screen.getByTestId("assess-queue")).toHaveTextContent("Report queued");
  });

  it("moves to 'Medical support now' when a warning sign is ticked", async () => {
    renderFuture(<AssessView />);
    await userEvent.click(screen.getByTestId("assess-warning-confusion"));
    await userEvent.click(screen.getByTestId("assess-submit"));
    expect(screen.getByTestId("assess-level")).toHaveTextContent("Medical support now");
    expect(screen.getByTestId("assess-steps")).toHaveTextContent(/URGENT report/);
  });
});

describe("F03 · Space Health Profile", () => {
  it("shows nine domains and 'No data' for exams that need unavailable equipment", () => {
    renderFuture(<ProfileView />);
    for (const d of ["neuro-ocular", "cardiovascular", "renal", "radiation", "bone", "vascular", "immunological", "emotional", "sleep"]) {
      expect(screen.getByTestId(`domain-${d}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId("metric-value-icp")).toHaveTextContent("No data");
    expect(screen.getByTestId("metric-icp")).toHaveTextContent(/does not simulate or estimate this value/);
    expect(screen.getByTestId("metric-value-bone-density")).toHaveTextContent("No data");
    expect(screen.getByTestId("metric-value-heart-rate")).toHaveTextContent(/bpm/);
  });

  it("records a typed reading as not validated and rejects out-of-range typing", async () => {
    renderFuture(<ProfileView />);
    await userEvent.selectOptions(screen.getByTestId("metric-select"), "bp-systolic");
    await userEvent.type(screen.getByTestId("metric-input"), "400");
    await userEvent.click(screen.getByTestId("metric-submit"));
    expect(screen.getByRole("alert")).toHaveTextContent(/not a clinical limit/);
    await userEvent.clear(screen.getByTestId("metric-input"));
    await userEvent.type(screen.getByTestId("metric-input"), "121");
    await userEvent.click(screen.getByTestId("metric-submit"));
    expect(screen.getByTestId("metric-value-bp-systolic")).toHaveTextContent("121 mmHg");
    expect(screen.getByTestId("metric-bp-systolic")).toHaveTextContent(/crew-entered \(not validated\)/);
  });
});

describe("F04 · EVA & Autonomous Response", () => {
  it("plans an EVA, proposes HOLD, requires a reason to override, and handles an event", async () => {
    renderFuture(<EvaView />);
    await userEvent.click(screen.getByTestId("eva-plan"));
    expect(screen.getByTestId("eva-proposal")).toHaveTextContent("HOLD");
    expect(screen.getByTestId("eva-go")).toBeDisabled();
    await userEvent.click(screen.getByTestId("equip-suit-telemetry"));
    expect(screen.getByTestId("eva-item-PRE-04")).toHaveTextContent(/Alternative step: Suit biomedical telemetry unavailable/);
    await userEvent.type(screen.getByTestId("eva-reason"), "Demo override");
    await userEvent.click(screen.getByTestId("eva-go"));
    expect(screen.getByTestId("eva-phase")).toHaveTextContent(/During EVA/);
    await userEvent.click(screen.getByTestId("eva-raise-EV-UNWELL"));
    const ev = screen.getByTestId("eva-event-EV-UNWELL");
    expect(ev).toHaveTextContent(/Telemetry unavailable: verbal status every 2 minutes/);
    await userEvent.click(within(ev).getByTestId("event-terminate"));
    expect(screen.getByTestId("eva-decisions")).toHaveTextContent(/override/);
    expect(screen.getByTestId("outbox-list")).toHaveTextContent(/urgent/);
  });
});

describe("F05 · Readiness & Trace", () => {
  it("shows crew readiness, passing system checks and a working tamper test", async () => {
    renderFuture(<ReadinessView />);
    expect(screen.getByTestId("readiness-overall-crew-a")).toHaveTextContent("Incomplete");
    expect(screen.getByTestId("verify-result-V-AUDIT")).toHaveTextContent("PASS");
    expect(screen.getByTestId("verify-result-V-NOT-VALIDATED")).toHaveTextContent("PASS");
    expect(screen.getByTestId("rulesets")).toHaveTextContent("ASTRA-SYM@0.1.0-demo");
    expect(screen.getByTestId("verification-matrix")).toHaveTextContent(/The existing 77 tests still pass/);
    await userEvent.click(screen.getByTestId("tamper-test"));
    expect(screen.getByTestId("tamper-result")).toHaveTextContent(/verification failed at entry #1/);
    expect(screen.getAllByTestId("audit-row")).toHaveLength(1);
  });
});

describe("platform bar, overview and offline persistence", () => {
  it("advances time, loses and restores the Earth link, and sends queued items", async () => {
    renderFuture(
      <FutureShell>
        <JournalView />
      </FutureShell>,
    );
    await waitFor(() => expect(screen.getByTestId("storage-status")).toHaveTextContent("Saved on this device"));
    await userEvent.click(screen.getByTestId("advance-60"));
    expect(screen.getByTestId("future-clock")).toHaveTextContent("Day 15 · 09:00");
    await userEvent.click(screen.getByTestId("link-toggle"));
    expect(screen.getByTestId("link-status")).toHaveTextContent(/LOST/);
    await userEvent.click(screen.getByTestId("journal-queue-summary"));
    expect(screen.getByTestId("outbox-count")).toHaveTextContent("1");
    await userEvent.click(screen.getByTestId("link-toggle"));
    await userEvent.click(screen.getByTestId("advance-60"));
    expect(screen.getByTestId("outbox-count")).toHaveTextContent("0");
  });

  it("saves to the device and restores after a remount (reload)", async () => {
    const first = renderFuture(<JournalView />, { persist: true });
    await userEvent.click(screen.getByTestId("routine-done-vision-check"));
    await waitFor(() => expect(window.localStorage.getItem(`${STORAGE_PREFIX}journal`)).toContain("vision-check"));
    first.unmount();
    renderFuture(<JournalView />, { persist: true });
    await waitFor(() => expect(screen.getByTestId("routine-vision-check")).toHaveTextContent(/Done today/));
  });

  it("restores demo data when stored data is corrupted, and says so in the trail", async () => {
    window.localStorage.setItem(`${STORAGE_PREFIX}platform`, "garbage");
    renderFuture(<ReadinessView />, { persist: true });
    await waitFor(() => expect(screen.getAllByTestId("audit-row")[0]).toHaveTextContent(/reset to demonstration data/));
  });

  it("overview lists the five modules", async () => {
    await act(async () => {
      renderFuture(<OverviewView />);
    });
    const cards = within(screen.getByTestId("future-modules")).getAllByRole("link");
    expect(cards.map((c) => c.getAttribute("href"))).toEqual(["/future/journal", "/future/assess", "/future/profile", "/future/eva", "/future/readiness"]);
  });
});
