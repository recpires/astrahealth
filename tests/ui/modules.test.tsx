/**
 * UI tests for the four modules, rendered with a frozen simulation clock.
 */
import { describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MonitorView } from "@/components/monitor/MonitorView";
import { AnalysisView } from "@/components/analysis/AnalysisView";
import { ResponseView } from "@/components/response/ResponseView";
import { CommsView } from "@/components/comms/CommsView";
import { createInitialState } from "@/lib/mission/reducer";
import { playedState, renderWithMission } from "./helpers";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Monitoring (MEASURE)", () => {
  it("shows the three simulated vital signs and sensor states", () => {
    renderWithMission(<MonitorView />, createInitialState());
    for (const k of ["hr", "spo2", "temp"]) {
      const card = screen.getByTestId(`vital-card-${k}`);
      expect(within(card).getByText(/Within demo range/i)).toBeInTheDocument();
      expect(screen.getByTestId(`sensor-${k}`)).toHaveTextContent(/Online/);
    }
    expect(screen.getAllByText(/Simulated data/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId("overall-level")).toHaveTextContent("NOMINAL");
  });

  it("starts the incident scenario from the 'Simulate incident' button", async () => {
    renderWithMission(<MonitorView />, createInitialState());
    await userEvent.click(screen.getByTestId("simulate-incident"));
    expect(screen.getByTestId("scenario-description")).toHaveTextContent(/Scenario 2/);
    await userEvent.click(screen.getByTestId("simulate-sensor-fault"));
    expect(screen.getByTestId("scenario-description")).toHaveTextContent(/Scenario 3/);
  });

  it("flags out-of-range vitals during the deviation scenario", () => {
    renderWithMission(<MonitorView />, playedState("vital-deviation"));
    expect(screen.getByTestId("overall-level")).toHaveTextContent("WARNING");
    expect(within(screen.getByTestId("vital-card-hr")).getByText(/Above demo range/)).toBeInTheDocument();
    expect(within(screen.getByTestId("vital-card-spo2")).getByText(/Below demo range/)).toBeInTheDocument();
  });
});

describe("Analysis (UNDERSTAND)", () => {
  it("explains findings, reliability and event history", () => {
    renderWithMission(<AnalysisView />, playedState("vital-deviation"));
    expect(screen.getByTestId("analysis-level")).toHaveTextContent("WARNING");
    expect(screen.getByTestId("reliability-label")).toHaveTextContent("High");
    expect(screen.getByTestId("finding-VITAL_OUT_OF_RANGE:hr")).toHaveTextContent(/not a diagnosis/);
    expect(screen.getAllByText("detected").length).toBe(3);
  });

  it("shows sensor issues with low reliability in the sensor-fault scenario", () => {
    renderWithMission(<AnalysisView />, playedState("sensor-fault"));
    expect(screen.getByTestId("analysis-level")).toHaveTextContent("CAUTION");
    expect(screen.getByTestId("reliability-label")).toHaveTextContent("Low");
    expect(screen.getByTestId("finding-READING_INCONSISTENT:spo2")).toHaveTextContent(/Confirmation needed/);
  });
});

describe("Response (ACT)", () => {
  it("asks for confirmation and resolves a sensor artifact", async () => {
    renderWithMission(<ResponseView />, playedState("sensor-fault"));
    expect(screen.getByTestId("medical-support")).toHaveTextContent(/not yet required/);
    const box = screen.getByTestId("confirm-spo2");
    await userEvent.click(within(box).getByRole("button", { name: /Take confirmation reading/ }));
    expect(screen.getByTestId("confirmation-result")).toHaveTextContent(/sensor artifact/);
    expect(screen.queryByTestId("confirm-spo2")).not.toBeInTheDocument();
    expect(screen.getByTestId("medical-support")).toHaveTextContent(/not required/);
    expect(screen.getByTestId("action-log")).toHaveTextContent(/NOT reproduced/);
  });

  it("indicates medical support and logs completed checklist steps", async () => {
    renderWithMission(<ResponseView />, playedState("vital-deviation"));
    expect(screen.getByTestId("medical-support")).toHaveTextContent(/Request medical support now/);
    const proc = screen.getByTestId("procedure-PROC-ESC-01");
    await userEvent.click(within(proc).getAllByRole("checkbox")[0]);
    expect(within(proc).getAllByRole("checkbox")[0]).toBeChecked();
    expect(screen.getByTestId("action-log")).toHaveTextContent(/Step completed \[PROC-ESC-01\]/);
  });
});

describe("Earth link (COMMUNICATE)", () => {
  it("configures the delay and shows the round-trip estimate", async () => {
    renderWithMission(<CommsView />, createInitialState());
    expect(screen.getByTestId("one-way-delay")).toHaveTextContent("12 min");
    expect(screen.getByTestId("round-trip")).toHaveTextContent("24 min");
    await userEvent.click(screen.getByRole("button", { name: /Long · 22 min/ }));
    expect(screen.getByTestId("round-trip")).toHaveTextContent("44 min");
  });

  it("generates a structured report and queues it for transmission", async () => {
    renderWithMission(<CommsView />, playedState("vital-deviation"));
    await userEvent.click(screen.getByTestId("generate-report"));
    expect(screen.getByTestId("report-preview")).toHaveTextContent(/SIMULATED DEMONSTRATION REPORT/);
    expect(screen.getByLabelText("Priority")).toHaveValue("urgent");
    await userEvent.click(screen.getByTestId("queue-report"));
    const row = screen.getByTestId("message-MSG-001");
    expect(row).toHaveAttribute("data-state", "queued");
    expect(row).toHaveTextContent(/Awaiting transmission/);
  });
});

describe("Sensor-fault presentation", () => {
  it("shows out-of-range values from a suspect sensor as unverified", () => {
    renderWithMission(<MonitorView />, playedState("sensor-fault"));
    const card = screen.getByTestId("vital-card-spo2");
    expect(within(card).getByText(/demo range · unverified/)).toBeInTheDocument();
    expect(within(card).getByText(/Sensor Suspect/i)).toBeInTheDocument();
  });
});
