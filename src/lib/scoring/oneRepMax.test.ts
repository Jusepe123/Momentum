import { describe, expect, it } from 'vitest'
import { brzycki1RM, epley1RM, estimate1RM } from './oneRepMax'

describe('epley1RM', () => {
  it('estimates 1RM as weight * (1 + reps/30)', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.6667, 3)
    expect(epley1RM(80, 8)).toBeCloseTo(101.3333, 3)
  })

  it('returns the weight itself for a single rep', () => {
    expect(epley1RM(140, 1)).toBe(140)
  })
})

describe('brzycki1RM', () => {
  it('estimates 1RM as weight * 36 / (37 - reps)', () => {
    expect(brzycki1RM(100, 5)).toBeCloseTo(112.5, 3)
    expect(brzycki1RM(80, 8)).toBeCloseTo(99.3103, 3)
  })

  it('returns the weight itself for a single rep', () => {
    expect(brzycki1RM(140, 1)).toBe(140)
  })
})

describe('estimate1RM', () => {
  it('returns both formulas and their mean', () => {
    const r = estimate1RM(100, 5)
    expect(r.epley).toBeCloseTo(116.6667, 3)
    expect(r.brzycki).toBeCloseTo(112.5, 3)
    expect(r.mean).toBeCloseTo(114.5833, 3)
  })

  it('rejects reps below 1, above 36, or fractional', () => {
    expect(() => estimate1RM(100, 0)).toThrow(RangeError)
    expect(() => estimate1RM(100, 37)).toThrow(RangeError)
    expect(() => estimate1RM(100, 2.5)).toThrow(RangeError)
  })

  it('rejects negative weight', () => {
    expect(() => estimate1RM(-5, 5)).toThrow(RangeError)
  })
})
