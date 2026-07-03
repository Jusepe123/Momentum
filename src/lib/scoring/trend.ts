import { epochDay } from './dates'

export interface TrendFit {
  slope: number
  intercept: number
  /** Coefficient of determination; 0 for flat data. */
  r2: number
}

/** Ordinary least-squares linear fit. Needs at least 2 distinct x values. */
export function fitTrend(points: { x: number; y: number }[]): TrendFit {
  const n = points.length
  const distinctX = new Set(points.map((p) => p.x))
  if (n < 2 || distinctX.size < 2) {
    throw new RangeError('fitTrend needs at least 2 points with distinct x values')
  }

  const meanX = points.reduce((s, p) => s + p.x, 0) / n
  const meanY = points.reduce((s, p) => s + p.y, 0) / n

  let sxx = 0
  let sxy = 0
  let syy = 0
  for (const p of points) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }

  const slope = sxy / sxx
  const intercept = meanY - slope * meanX
  const r2 = syy === 0 ? 0 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2 }
}

export interface MetricPoint {
  /** Calendar date, YYYY-MM-DD. */
  date: string
  value: number
}

export interface Projection {
  /** Projected metric value daysAhead days after the last data point. */
  value: number
  slopePerDay: number
  r2: number
}

/** Minimum history needed before a projection is shown. */
export const MIN_PROJECTION_POINTS = 4
export const MIN_PROJECTION_SPAN_DAYS = 14

/**
 * "Future gains": extrapolate the linear trend of a metric daysAhead days
 * past the most recent data point. Returns null when history is too thin
 * to project responsibly (fewer than 4 points or spanning under 14 days).
 * The projection is clamped at zero — no negative 1RMs or paces.
 */
export function projectMetric(history: MetricPoint[], daysAhead: number): Projection | null {
  if (history.length < MIN_PROJECTION_POINTS) return null

  const points = history
    .map((p) => ({ x: epochDay(p.date), y: p.value }))
    .sort((a, b) => a.x - b.x)

  const first = points[0]
  const last = points[points.length - 1]
  if (last.x - first.x < MIN_PROJECTION_SPAN_DAYS) return null

  const fit = fitTrend(points)
  const targetX = last.x + daysAhead
  const value = Math.max(0, fit.slope * targetX + fit.intercept)
  return { value, slopePerDay: fit.slope, r2: fit.r2 }
}
