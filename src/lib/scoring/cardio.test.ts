import { describe, expect, it } from 'vitest'
import { paceSecPer100m, paceSecPerKm, riegelPredict } from './cardio'

describe('riegelPredict', () => {
  it('predicts time for a longer distance (T2 = T1 * (D2/D1)^1.06)', () => {
    // 5 km in 20:00 -> 10 km (values computed with node, not by hand)
    expect(riegelPredict(1200, 5000, 10000)).toBeCloseTo(2501.918, 2)
  })

  it('predicts time for a shorter distance', () => {
    expect(riegelPredict(3000, 10000, 5000)).toBeCloseTo(1438.896, 2)
  })

  it('returns the same time for the same distance', () => {
    expect(riegelPredict(1500, 5000, 5000)).toBe(1500)
  })

  it('is superlinear: doubling distance more than doubles time', () => {
    expect(riegelPredict(1200, 5000, 10000)).toBeGreaterThan(2400)
  })

  it('rejects non-positive inputs', () => {
    expect(() => riegelPredict(0, 5000, 10000)).toThrow(RangeError)
    expect(() => riegelPredict(1200, 0, 10000)).toThrow(RangeError)
    expect(() => riegelPredict(1200, 5000, 0)).toThrow(RangeError)
  })
})

describe('paceSecPerKm', () => {
  it('returns seconds per kilometre', () => {
    expect(paceSecPerKm(1500, 5000)).toBe(300) // 25:00 for 5 km = 5:00/km
  })

  it('rejects non-positive duration or distance', () => {
    expect(() => paceSecPerKm(0, 5000)).toThrow(RangeError)
    expect(() => paceSecPerKm(1500, 0)).toThrow(RangeError)
  })
})

describe('paceSecPer100m', () => {
  it('returns seconds per 100 m', () => {
    expect(paceSecPer100m(1800, 3000)).toBe(60) // 30:00 for 3 km swim = 1:00/100m
  })

  it('rejects non-positive duration or distance', () => {
    expect(() => paceSecPer100m(-1, 3000)).toThrow(RangeError)
    expect(() => paceSecPer100m(1800, -3000)).toThrow(RangeError)
  })
})
