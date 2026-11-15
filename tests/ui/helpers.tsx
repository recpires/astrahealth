import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MissionProvider } from "@/state/MissionProvider";
import { createInitialState, missionReducer, type MissionState } from "@/lib/mission/reducer";
import { SCENARIOS } from "@/lib/scenarios";
import type { ScenarioId } from "@/lib/types";

/** Mission state after playing a whole scenario (pure reducer, no timers). */
export function playedState(scenarioId: ScenarioId): MissionState {
  let s = missionReducer(createInitialState(), { type: "START_SCENARIO", scenarioId });
  const sc = SCENARIOS[scenarioId];
  const seconds = sc.samples.length * sc.sampleIntervalSec;
  for (let i = 0; i < seconds / s.timeScale; i++) s = missionReducer(s, { type: "TICK", dtRealSec: 1 });
  return s;
}

export function renderWithMission(ui: ReactElement, initialState?: MissionState) {
  return render(
    <MissionProvider initialState={initialState} autoTick={false}>
      {ui}
    </MissionProvider>,
  );
}
