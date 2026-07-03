import { describe, expect, it } from 'vitest'
import { fitTrend, projectMetric } from './trend'

describe('fitTrend (least-squares linear fit)', () => {
  it('recovers a perfect line', () => {
    const fit = fitTrend([
      { x: 0, y: 1 },
      { x: 1, y: 3 },
      { x: 2, y: 5 },
      { x: 3, y: 7 },
    ])
    expect(fit.slope).toBeCloseTo(2, 9)
    expect(fit.intercept).toBeCloseTo(1, 9)
    expect(fit.r2).toBeCloseTo(1, 9)
  })

  it('gives slope 0 and r2 0 for flat data', () => {
    const fit = fitTrend([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
    ])
    expect(fit.slope).toBe(0)
    expect(fit.r2).toBe(0)
  })

  it('requires at least 2 distinct x values', () => {
    expect(() => fitTrend([{ x: 1, y: 2 }])).toThrow(RangeError)
    expect(() =>
      fitTrend([
        { x: 1, y: 2 },
        { x: 1, y: 4 },
      ]),
    ).toThrow(RangeError)
  })
})

describe('projectMetric (future gains)', () => {
  // Weekly bench 1RM improving 2 kg/week: 100, 102, 104, 106.
  const history = [
    { date: '2026-01-05', value: 100 },
    { date: '2026-01-12', value: 102 },
    { date: '2026-01-19', value: 104 },
    { date: '2026-01-26', value: 106 },
  ]

  it('extrapolates the linear trend from the last data point', () => {
    const p = projectMetric(history, 28)
    expect(p).not.toBeNull()
    expect(p!.value).toBeCloseTo(114, 6) // 106 + (2/7 per day) * 28 days
    expect(p!.slopePerDay).toBeCloseTo(2 / 7, 6)
  })

  it('returns null with fewer than 4 points', () => {
    expect(projectMetric(history.slice(0, 3), 28)).toBeNull()
  })

  it('returns null when history spans less than 14 days', () => {
    const shortSpan = [
      { date: '2026-01-05', value: 100 },
      { date: '2026-01-08', value: 101 },
      { date: '2026-01-11', value: 102 },
      { date: '2026-01-14', value: 103 },
    ]
    expect(projectMetric(shortSpan, 28)).toBeNull()
  })

  it('never projects below zero', () => {
    const declining = [
      { date: '2026-01-05', value: 30 },
      { date: '2026-01-12', value: 20 },
      { date: '2026-01-19', value: 10 },
      { date: '2026-01-26', value: 5 },
    ]
    const p = projectMetric(declining, 365)
    expect(p!.value).toBe(0)
  })

  it('accepts unsorted history', () => {
    const shuffled = [history[2], history[0], history[3], history[1]]
    expect(projectMetric(shuffled, 28)!.value).toBeCloseTo(114, 6)
  })
})
