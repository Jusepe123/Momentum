/**
 * Pure GPS distance accumulator with a jitter/teleport filter. No I/O, no
 * expo imports — tested in Node with vitest, same culture as web src/lib/scoring.
 *
 * Semantics are pinned by distance.test.ts; the numeric thresholds live in
 * FilterConfig so field calibration can tune them without touching the rules.
 */

export interface GeoPoint {
  latitude: number
  longitude: number
  /** metres, null when the platform doesn't report it */
  accuracy: number | null
  /** epoch ms */
  timestamp: number
}

export interface FilterConfig {
  /** drop fixes with worse (larger) reported accuracy than this */
  maxAccuracyM: number
  /** displacement below this keeps the old anchor (GPS jitter gate) */
  minDisplacementM: number
  /** apparent speed above this is a teleport: re-anchor, add nothing */
  maxSpeedMps: number
}

/** Running filter: the teleport gate is ~2:00 min/km — nobody runs faster. */
export const RUN_FILTER: FilterConfig = {
  maxAccuracyM: 25,
  minDisplacementM: 5,
  maxSpeedMps: 12.5, // ~2:00 min/km pace — nobody runs faster
}

/** Cycling filter: same accuracy/jitter gates, but a much higher teleport gate
 *  (~90 km/h) — cyclists descend far faster than 12.5 m/s and the run cap would
 *  wrongly discard legitimate fast fixes. */
export const BIKE_FILTER: FilterConfig = {
  maxAccuracyM: 25,
  minDisplacementM: 5,
  maxSpeedMps: 25, // ~90 km/h — descents are real
}

/** Backward-compat alias; the default matches running behavior. */
export const DEFAULT_FILTER: FilterConfig = RUN_FILTER

export function filterForSport(sport: 'run' | 'bike'): FilterConfig {
  return sport === 'bike' ? BIKE_FILTER : RUN_FILTER
}

export interface DistanceState {
  totalM: number
  anchor: GeoPoint | null
}

export const initialDistanceState: DistanceState = { totalM: 0, anchor: null }

const EARTH_RADIUS_M = 6371000

export function haversineM(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}

/**
 * Fold one GPS fix into the accumulator. Rules, in order:
 *  1. accuracy worse than the gate → ignore the fix entirely
 *  2. no anchor yet → this fix becomes the anchor, adds nothing
 *  3. displacement below the jitter gate → keep the OLD anchor, so slow
 *     movement still accumulates once it drifts past the gate
 *  4. apparent speed above the teleport gate (or time not advancing) →
 *     re-anchor here, add nothing
 *  5. otherwise → add the haversine step and move the anchor
 */
export function advance(
  state: DistanceState,
  point: GeoPoint,
  cfg: FilterConfig = DEFAULT_FILTER,
): DistanceState {
  // Deliberate: a null accuracy is trusted. Some OEM stacks omit it, and
  // dropping those fixes would zero the whole run; the displacement and
  // speed gates below still bound the damage from a bad fix.
  if (point.accuracy !== null && point.accuracy > cfg.maxAccuracyM) return state
  if (state.anchor === null) return { totalM: state.totalM, anchor: point }

  const d = haversineM(state.anchor, point)
  if (d < cfg.minDisplacementM) return state

  const dtSec = (point.timestamp - state.anchor.timestamp) / 1000
  if (dtSec <= 0 || d / dtSec > cfg.maxSpeedMps) {
    return { totalM: state.totalM, anchor: point }
  }

  return { totalM: state.totalM + d, anchor: point }
}

/** Call on resume: movement during the pause must never count. */
export function resetAnchor(state: DistanceState): DistanceState {
  return { totalM: state.totalM, anchor: null }
}
