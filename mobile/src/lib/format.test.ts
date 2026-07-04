import { describe, expect, it } from 'vitest'
import { formatElapsed, formatKm, formatPace } from './format'

describe('formatKm', () => {
  it('renders metres as km with 2 decimals', () => {
    expect(formatKm(0)).toBe('0.00')
    expect(formatKm(5234)).toBe('5.23')
    expect(formatKm(21100)).toBe('21.10')
  })
})

describe('formatElapsed', () => {
  it('uses mm:ss under an hour', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(59000)).toBe('0:59')
    expect(formatElapsed(605000)).toBe('10:05')
  })
  it('uses h:mm:ss from one hour', () => {
    // node -e: 3600000+82000 = 3682000 → 1:01:22
    expect(formatElapsed(3682000)).toBe('1:01:22')
  })
  it('clamps negatives to zero', () => {
    expect(formatElapsed(-500)).toBe('0:00')
  })
})

describe('formatPace', () => {
  it('withholds pace until 100 m and 30 s', () => {
    expect(formatPace(60000, 99)).toBe('—:—')
    expect(formatPace(29000, 500)).toBe('—:—')
  })
  it('computes average min/km', () => {
    // node -e: 1500000 ms over 5000 m → 300000 ms/km → 5:00
    expect(formatPace(1500000, 5000)).toBe('5:00')
    // node -e: 330000 ms over 1000 m → 5.5 min → 5:30
    expect(formatPace(330000, 1000)).toBe('5:30')
  })
})
