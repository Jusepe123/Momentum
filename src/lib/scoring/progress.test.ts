import { describe, expect, it } from 'vitest'
import { detectPlateau, detectPR } from './progress'

describe('detectPR', () => {
  it('detects a new PR when higher is better (1RM, distance)', () => {
    expect(detectPR([100, 105, 110], 112, 'higher')).toBe(true)
    expect(detectPR([100, 105, 110], 110, 'higher')).toBe(false)
    expect(detectPR([100, 105, 110], 90, 'higher')).toBe(false)
  })

  it('detects a new PR when lower is better (pace)', () => {
    expect(detectPR([300, 290, 285], 280, 'lower')).toBe(true)
    expect(detectPR([300, 290, 285], 285, 'lower')).toBe(false)
  })

  it('treats the first ever value as a PR', () => {
    expect(detectPR([], 100, 'higher')).toBe(true)
    expect(detectPR([], 300, 'lower')).toBe(true)
  })
})

describe('detectPlateau', () => {
  // Window: last 4 weeks (28 days) before asOf, inclusive.
  const asOf = '2026-05-31'

  it('flags a plateau when the recent best does not beat the earlier best', () => {
    const history = [
      { date: '2026-04-01', value: 120 },
      { date: '2026-05-10', value: 118 }, // inside window, no improvement
      { date: '2026-05-25', value: 120 }, // ties, still no improvement
    ]
    expect(detectPlateau(history, asOf, 4)).toBe(true)
  })

  it('does not flag when the recent window contains an improvement', () => {
    const history = [
      { date: '2026-04-01', value: 120 },
      { date: '2026-05-25', value: 122 },
    ]
    expect(detectPlateau(history, asOf, 4)).toBe(false)
  })

  it('flags a plateau when there is no data at all in the recent window', () => {
    const history = [
      { date: '2026-03-01', value: 120 },
      { date: '2026-04-01', value: 125 },
    ]
    expect(detectPlateau(history, asOf, 4)).toBe(true)
  })

  it('does not flag when all data is inside the window (still establishing a baseline)', () => {
    const history = [
      { date: '2026-05-20', value: 100 },
      { date: '2026-05-27', value: 100 },
    ]
    expect(detectPlateau(history, asOf, 4)).toBe(false)
  })

  it('does not flag with empty history', () => {
    expect(detectPlateau([], asOf, 4)).toBe(false)
  })
})
