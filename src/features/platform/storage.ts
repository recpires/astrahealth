/**
 * On-device persistence of the FUTURE modules (offline-first).
 *
 * Each module is stored under its own versioned key. Stored data is validated
 * before use; anything unreadable is replaced by the demonstration seed and the
 * replacement is written to the audit trail. Nothing is sent over the network.
 */
import { createFutureState, type FutureState } from "@/features/platform/store";

export const STORAGE_PREFIX = "astra-health.future.v1.";
export const SLICES = ["platform", "journal", "assess", "profile", "eva"] as const;
export type SliceKey = (typeof SLICES)[number];

export const SLICE_MODULE: Record<SliceKey, string> = {
  platform: "platform (clock, audit trail, Earth link queue)",
  journal: "FUTURE 01 journal",
  assess: "FUTURE 02 assessments",
  profile: "FUTURE 03 health profile",
  eva: "FUTURE 04 EVA",
};

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function getStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function isStorageWritable(storage: StorageLike | null): boolean {
  if (!storage) return false;
  try {
    const k = `${STORAGE_PREFIX}probe`;
    storage.setItem(k, "1");
    storage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isTime = (v: unknown) => isObj(v) && typeof v.day === "number" && typeof v.minute === "number";

const VALIDATORS: Record<SliceKey, (v: unknown) => boolean> = {
  platform: (v) =>
    isObj(v) &&
    v.schemaVersion === 1 &&
    isTime(v.clock) &&
    isObj(v.link) &&
    typeof v.link.available === "boolean" &&
    typeof v.link.oneWayDelayMin === "number" &&
    isTime(v.link.since) &&
    Array.isArray(v.audit) &&
    Array.isArray(v.outbox) &&
    typeof v.nextId === "number",
  journal: (v) =>
    isObj(v) &&
    v.schemaVersion === 1 &&
    Array.isArray(v.checkIns) &&
    v.checkIns.every((c) => isObj(c) && typeof c.crewId === "string" && isTime(c.at) && Array.isArray(c.symptoms)) &&
    Array.isArray(v.completions),
  assess: (v) => isObj(v) && v.schemaVersion === 1 && Array.isArray(v.records),
  profile: (v) => isObj(v) && v.schemaVersion === 1 && Array.isArray(v.entries),
  eva: (v) => isObj(v) && v.schemaVersion === 1 && isObj(v.equipment) && Array.isArray(v.history) && (v.session === null || isObj(v.session)),
};

export interface LoadResult {
  state: FutureState;
  /** True when at least one module was found in storage. */
  found: boolean;
  notes: string[];
}

export function loadFutureState(storage: StorageLike): LoadResult {
  const seed = createFutureState();
  const notes: string[] = [];
  const parsed: Partial<Record<SliceKey, unknown>> = {};
  let found = false;
  for (const key of SLICES) {
    let raw: string | null = null;
    try {
      raw = storage.getItem(STORAGE_PREFIX + key);
    } catch {
      raw = null;
    }
    if (raw === null) continue;
    found = true;
    try {
      const value = JSON.parse(raw);
      if (VALIDATORS[key](value)) parsed[key] = value;
      else notes.push(`Stored ${SLICE_MODULE[key]} data failed validation — demonstration data restored for it.`);
    } catch {
      notes.push(`Stored ${SLICE_MODULE[key]} data was unreadable — demonstration data restored for it.`);
    }
  }
  if (!found) return { state: seed, found, notes };
  if (!parsed.platform) {
    // Identifiers and the audit trail live in the platform slice: without it nothing else can be trusted.
    return { state: seed, found, notes: [...notes, "Platform data missing or invalid — every FUTURE module was reset to demonstration data."] };
  }
  return {
    found,
    notes,
    state: {
      platform: parsed.platform as FutureState["platform"],
      journal: (parsed.journal as FutureState["journal"]) ?? seed.journal,
      assess: (parsed.assess as FutureState["assess"]) ?? seed.assess,
      profile: (parsed.profile as FutureState["profile"]) ?? seed.profile,
      eva: (parsed.eva as FutureState["eva"]) ?? seed.eva,
    },
  };
}

export function saveFutureState(storage: StorageLike, state: FutureState, previous?: FutureState | null): boolean {
  try {
    for (const key of SLICES) {
      if (previous && previous[key] === state[key]) continue;
      storage.setItem(STORAGE_PREFIX + key, JSON.stringify(state[key]));
    }
    return true;
  } catch {
    return false;
  }
}

export function clearFutureState(storage: StorageLike): void {
  for (const key of SLICES) {
    try {
      storage.removeItem(STORAGE_PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}
