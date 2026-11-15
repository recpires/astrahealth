"use client";

import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState, type Dispatch, type ReactNode } from "react";
import { createFutureState, futureReducer, type FutureAction, type FutureState } from "@/features/platform/store";
import { clearFutureState, getStorage, isStorageWritable, loadFutureState, saveFutureState } from "@/features/platform/storage";
import type { CrewId } from "@/features/journal/types";

interface FutureContextValue {
  state: FutureState;
  dispatch: Dispatch<FutureAction>;
  /** True once on-device data has been loaded (or persistence is off). */
  ready: boolean;
  storageWritable: boolean | null;
  crewId: CrewId;
  setCrewId: (id: CrewId) => void;
  resetDemo: () => void;
}

const FutureContext = createContext<FutureContextValue | null>(null);

type Wrapped = { state: FutureState; ready: boolean };
type WrappedAction = FutureAction | { type: "ui/ready" };

function wrappedReducer(s: Wrapped, a: WrappedAction): Wrapped {
  if (a.type === "ui/ready") return s.ready ? s : { ...s, ready: true };
  const next = futureReducer(s.state, a);
  return next === s.state ? s : { ...s, state: next };
}

export function FutureProvider({
  children,
  initialState,
  persist = true,
}: {
  children: ReactNode;
  initialState?: FutureState;
  persist?: boolean;
}) {
  const [wrapped, dispatch] = useReducer(wrappedReducer, undefined, () => ({ state: initialState ?? createFutureState(), ready: !persist }));
  const [crewId, setCrewId] = useState<CrewId>("crew-a");
  const [storageWritable, setStorageWritable] = useState<boolean | null>(null);
  const saved = useRef<FutureState | null>(null);

  // Load once on the client (the server-rendered HTML always starts from the demo seed).
  useEffect(() => {
    if (!persist) return;
    const storage = getStorage();
    const writable = isStorageWritable(storage);
    if (storage) {
      const result = loadFutureState(storage);
      if (result.found) dispatch({ type: "platform/hydrate", state: result.state, notes: result.notes });
    }
    dispatch({ type: "ui/ready" });
    queueMicrotask(() => setStorageWritable(writable));
  }, [persist]);

  // Persist every change once loaded.
  useEffect(() => {
    if (!persist || !wrapped.ready) return;
    const storage = getStorage();
    if (storage && saveFutureState(storage, wrapped.state, saved.current)) saved.current = wrapped.state;
  }, [persist, wrapped.ready, wrapped.state]);

  const value = useMemo<FutureContextValue>(
    () => ({
      state: wrapped.state,
      dispatch: dispatch as Dispatch<FutureAction>,
      ready: wrapped.ready,
      storageWritable,
      crewId,
      setCrewId,
      resetDemo: () => {
        const storage = getStorage();
        if (storage) clearFutureState(storage);
        saved.current = null;
        dispatch({ type: "platform/reset" });
      },
    }),
    [wrapped, storageWritable, crewId],
  );
  return <FutureContext.Provider value={value}>{children}</FutureContext.Provider>;
}

export function useFuture(): FutureContextValue {
  const ctx = useContext(FutureContext);
  if (!ctx) throw new Error("useFuture must be used inside <FutureProvider>");
  return ctx;
}
