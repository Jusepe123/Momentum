import { describe, expect, it } from 'vitest'
import { sessionLoad, volumeLoad } from './load'

describe('sessionLoad (Foster session-RPE)', () => {
  it('multiplies RPE by duration in minutes', () => {
    expect(sessionLoad(7, 60)).toBe(420)
    expect(sessionLoad(5.5, 30)).toBe(165)
  })

  it('accepts the RPE boundaries 0 and 10', () => {
    expect(sessionLoad(0, 45)).toBe(0)
    expect(sessionLoad(10, 45)).toBe(450)
  })

  it('rejects RPE outside 0-10', () => {
    expect(() => sessionLoad(-1, 60)).toThrow(RangeError)
    expect(() => sessionLoad(10.5, 60)).toThrow(RangeError)
  })

  it('rejects non-positive duration', () => {
    expect(() => sessionLoad(7, 0)).toThrow(RangeError)
    expect(() => sessionLoad(7, -10)).toThrow(RangeError)
  })
})

describe('volumeLoad', () => {
  it('sums weight x reps across sets', () => {
    expect(
      volumeLoad([
        { weightKg: 100, reps: 5 },
        { weightKg: 110, reps: 3 },
        { weightKg: 60, reps: 10 },
      ]),
    ).toBe(100 * 5 + 110 * 3 + 60 * 10)
  })

  it('returns 0 for no sets', () => {
    expect(volumeLoad([])).toBe(0)
  })

  it('counts bodyweight (0 kg) sets as zero volume', () => {
    expect(volumeLoad([{ weightKg: 0, reps: 12 }])).toBe(0)
  })
})
