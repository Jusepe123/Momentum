/**
 * Unified session load (Foster session-RPE): RPE (0-10) x duration (minutes).
 * This is the common denominator across all sports, feeding ACWR.
 */
export function sessionLoad(rpe: number, durationMin: number): number {
  if (!Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
    throw new RangeError(`RPE must be between 0 and 10, got ${rpe}`)
  }
  if (!Number.isFinite(durationMin) || durationMin <= 0) {
    throw new RangeError(`Duration must be positive, got ${durationMin}`)
  }
  return rpe * durationMin
}

export interface SetInput {
  weightKg: number
  reps: number
}

/** Strength-specific volume-load: sum of weight x reps across all sets. */
export function volumeLoad(sets: SetInput[]): number {
  return sets.reduce((total, s) => total + s.weightKg * s.reps, 0)
}
