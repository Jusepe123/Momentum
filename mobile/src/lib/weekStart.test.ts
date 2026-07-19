import { describe, expect, it } from 'vitest'
import { weekStartISO } from './weekStart'

// Expected values verified with node: 2026-07-13 is a Monday, 2026-07-19 a Sunday.
describe('weekStartISO', () => {
  it('returns the Monday of the week containing the date', () => {
    expect(weekStartISO('2026-07-19')).toBe('2026-07-13') // Sunday
    expect(weekStartISO('2026-07-15')).toBe('2026-07-13') // Wednesday
  })

  it('is the identity on a Monday', () => {
    expect(weekStartISO('2026-07-13')).toBe('2026-07-13')
  })

  it('crosses month boundaries', () => {
    expect(weekStartISO('2026-07-01')).toBe('2026-06-29') // Wed → prior Monday in June
  })
})
