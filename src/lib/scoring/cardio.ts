function assertPositive(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be positive, got ${value}`)
  }
}

/**
 * Riegel race-time prediction: T2 = T1 * (D2/D1)^1.06.
 * Times in seconds, distances in metres.
 */
export function riegelPredict(t1Sec: number, d1M: number, d2M: number): number {
  assertPositive(t1Sec, 'Time')
  assertPositive(d1M, 'Known distance')
  assertPositive(d2M, 'Target distance')
  return t1Sec * Math.pow(d2M / d1M, 1.06)
}

/** Running pace in seconds per kilometre. */
export function paceSecPerKm(durationSec: number, distanceM: number): number {
  assertPositive(durationSec, 'Duration')
  assertPositive(distanceM, 'Distance')
  return durationSec / (distanceM / 1000)
}

/** Cycling speed in kilometres per hour. */
export function speedKmH(durationSec: number, distanceM: number): number {
  assertPositive(durationSec, 'Duration')
  assertPositive(distanceM, 'Distance')
  return distanceM / 1000 / (durationSec / 3600)
}
