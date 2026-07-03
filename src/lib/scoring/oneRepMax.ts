/**
 * Estimated one-rep max. Both formulas converge to the lifted weight at
 * reps = 1 (Epley is special-cased; the raw formula would overshoot by w/30).
 * Brzycki's domain ends at reps = 36 (division by zero at 37), and neither
 * formula is meaningful beyond that, so reps are capped there.
 */

function validate(weightKg: number, reps: number): void {
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    throw new RangeError(`Weight must be non-negative, got ${weightKg}`)
  }
  if (!Number.isInteger(reps) || reps < 1 || reps > 36) {
    throw new RangeError(`Reps must be an integer between 1 and 36, got ${reps}`)
  }
}

export function epley1RM(weightKg: number, reps: number): number {
  validate(weightKg, reps)
  if (reps === 1) return weightKg
  return weightKg * (1 + reps / 30)
}

export function brzycki1RM(weightKg: number, reps: number): number {
  validate(weightKg, reps)
  return (weightKg * 36) / (37 - reps)
}

export interface OneRepMaxEstimate {
  epley: number
  brzycki: number
  mean: number
}

export function estimate1RM(weightKg: number, reps: number): OneRepMaxEstimate {
  const epley = epley1RM(weightKg, reps)
  const brzycki = brzycki1RM(weightKg, reps)
  return { epley, brzycki, mean: (epley + brzycki) / 2 }
}
