import { describe, expect, it } from 'vitest'
import { reduceLastLifts } from './lastLifts'

const set = (exercise_id: string, weight_kg: number, reps: number) => ({
  exercise_id,
  weight_kg,
  reps,
})

describe('reduceLastLifts', () => {
  it('takes each exercise from its most recent session (rows sorted date desc)', () => {
    const rows = [
      { date: '2026-07-17', strength_sets: [set('bench', 50, 8)] },
      { date: '2026-07-10', strength_sets: [set('bench', 47.5, 8), set('squat', 80, 5)] },
    ]
    expect(reduceLastLifts(rows)).toEqual({
      bench: { weightKg: 50, reps: 8, date: '2026-07-17' },
      squat: { weightKg: 80, reps: 5, date: '2026-07-10' },
    })
  })

  it('within a session keeps the heaviest set, breaking ties by more reps', () => {
    const rows = [
      {
        date: '2026-07-17',
        strength_sets: [set('bench', 40, 10), set('bench', 50, 5), set('bench', 50, 8)],
      },
    ]
    expect(reduceLastLifts(rows)).toEqual({
      bench: { weightKg: 50, reps: 8, date: '2026-07-17' },
    })
  })

  it('returns empty for no sessions', () => {
    expect(reduceLastLifts([])).toEqual({})
  })
})
