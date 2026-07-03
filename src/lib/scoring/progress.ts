import { epochDay } from './dates'
import type { MetricPoint } from './trend'

/**
 * A new value is a personal record when it strictly beats every previous
 * value. 'higher' for 1RM/distance, 'lower' for pace. The first value ever
 * recorded always counts as a PR.
 */
export function detectPR(
  previousValues: number[],
  newValue: number,
  better: 'higher' | 'lower',
): boolean {
  if (previousValues.length === 0) return true
  return better === 'higher'
    ? newValue > Math.max(...previousValues)
    : newValue < Math.min(...previousValues)
}

/**
 * Plateau: the best value in the last `weeks` weeks (ending at asOf,
 * inclusive) fails to beat the best value recorded before that window.
 * Not a plateau when there is no earlier baseline to beat.
 */
export function detectPlateau(history: MetricPoint[], asOf: string, weeks: number): boolean {
  const end = epochDay(asOf)
  const windowStart = end - (weeks * 7 - 1)

  let bestBefore: number | null = null
  let bestInWindow: number | null = null
  for (const p of history) {
    const day = epochDay(p.date)
    if (day > end) continue
    if (day < windowStart) {
      bestBefore = bestBefore === null ? p.value : Math.max(bestBefore, p.value)
    } else {
      bestInWindow = bestInWindow === null ? p.value : Math.max(bestInWindow, p.value)
    }
  }

  if (bestBefore === null) return false
  return bestInWindow === null || bestInWindow <= bestBefore
}
