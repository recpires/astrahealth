"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from "react";
import {
  createInitialState,
  deriveView,
  missionReducer,
  type MissionAction,
  type MissionState,
  type MissionView,
} from "@/lib/mission/reducer";

interface MissionContextValue {
  state: MissionState;
  view: MissionView;
  dispatch: Dispatch<MissionAction>;
}

const MissionContext = createContext<MissionContextValue | null>(null);

/** Real-time interval between simulation ticks (ms). */
const TICK_MS = 250;

export function MissionProvider({
  children,
  initialState,
  autoTick = true,
}: {
  children: ReactNode;
  initialState?: MissionState;
  autoTick?: boolean;
}) {
  const [state, dispatch] = useReducer(missionReducer, initialState, (s) => s ?? createInitialState());

  useEffect(() => {
    if (!autoTick) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // Cap the step so a backgrounded tab does not fast-forward the simulation.
      const dt = Math.min(1, (now - last) / 1000);
      last = now;
      dispatch({ type: "TICK", dtRealSec: dt });
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [autoTick]);

  const view = useMemo(() => deriveView(state), [state]);
  const value = useMemo(() => ({ state, view, dispatch }), [state, view]);
  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error("useMission must be used inside <MissionProvider>");
  return ctx;
}
