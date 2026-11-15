/**
 * Earth–Mars signal delay helpers.
 *
 * SIMULATION ONLY. The 3–22 minute one-way range comes from the ASTRA Health
 * team brief; it is an approximation that varies with planetary positions and
 * must be cross-checked against the confirmed NASA resource. No real
 * spacecraft link is modelled.
 */

export const MIN_ONE_WAY_DELAY_MIN = 3;
export const MAX_ONE_WAY_DELAY_MIN = 22;
export const DEFAULT_ONE_WAY_DELAY_MIN = 12;

/** Speed of light in vacuum, km/s (exact by SI definition). */
export const SPEED_OF_LIGHT_KM_S = 299_792.458;

export const DELAY_PRESETS = [
  { label: "Short", minutes: 3 },
  { label: "Medium", minutes: 12 },
  { label: "Long", minutes: 22 },
] as const;

export function clampDelayMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_ONE_WAY_DELAY_MIN;
  return Math.min(MAX_ONE_WAY_DELAY_MIN, Math.max(MIN_ONE_WAY_DELAY_MIN, minutes));
}

/** Minimum round-trip time (signal there and back), excluding any ground response time. */
export function roundTripMinutes(oneWayMinutes: number): number {
  return 2 * clampDelayMinutes(oneWayMinutes);
}

/** Distance light travels during the one-way delay (pure physics, km). */
export function lightTravelDistanceKm(oneWayMinutes: number): number {
  return clampDelayMinutes(oneWayMinutes) * 60 * SPEED_OF_LIGHT_KM_S;
}
