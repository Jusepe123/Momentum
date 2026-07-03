import { describe, expect, it } from 'vitest'
import type { SessionWithDetails } from '../sessions/hooks'
import {
  acwrSeries,
  computePRs,
  dailyLoadSeries,
  paceHistory,
  strengthHistories,
} from './selectors'

type Overrides = Partial<SessionWithDetails> & { date: string }

function session(o: Overrides): SessionWithDetails {
  return {
    id: o.id ?? crypto.randomUUID(),
    user_id: 'u1',
    sport: o.sport ?? 'strength',
    date: o.date,
    duration_min: o.duration_min ?? 60,
    rpe: o.rpe ?? 7,
    unified_load: o.unified_load ?? (o.duration_min ?? 60) * (o.rpe ?? 7),
    notes: null,
    created_at: `${o.date}T10:00:00Z`,
    strength_sets: o.strength_sets ?? [],
    cardio_details: o.cardio_details ?? null,
  }
}

function strengthSet(exerciseId: string, name: string, weightKg: number, reps: number) {
  return {
    id: crypto.randomUUID(),
    session_id: 's',
    exercise_id: exerciseId,
    weight_kg: weightKg,
    reps,
    set_order: 1,
    exercise: { id: exerciseId, name, user_id: null, created_at: '' },
  }
}

describe('dailyLoadSeries', () => {
  it('zero-fills days without sessions and sums same-day sessions', () => {
    const sessions = [
      session({ date: '2026-06-29', unified_load: 100 }),
      session({ date: '2026-06-29', unified_load: 50 }),
      session({ date: '2026-07-01', unified_load: 200 }),
    ]
    const series = dailyLoadSeries(sessions, '2026-07-01', 3)
    expect(series).toEqual([
      { date: '2026-06-29', load: 150 },
      { date: '2026-06-30', load: 0 },
      { date: '2026-07-01', load: 200 },
    ])
  })

  it('excludes sessions outside the window', () => {
    const sessions = [
      session({ date: '2026-06-28', unified_load: 999 }),
      session({ date: '2026-07-02', unified_load: 999 }),
    ]
    const series = dailyLoadSeries(sessions, '2026-07-01', 3)
    expect(series.every((d) => d.load === 0)).toBe(true)
  })
})

describe('acwrSeries', () => {
  it('produces one ratio per day, null before any chronic load exists', () => {
    const sessions = [session({ date: '2026-07-01', unified_load: 100 })]
    const series = acwrSeries(sessions, '2026-07-02', 2)
    expect(series).toHaveLength(2)
    expect(series[0].date).toBe('2026-07-01')
    // on 2026-07-01 the chronic window includes that day's load
    expect(series[0].ratio).not.toBeNull()
    expect(series[1].date).toBe('2026-07-02')
  })

  it('is 1.0 under uniform daily load', () => {
    const sessions = Array.from({ length: 28 }, (_, i) => {
      const day = String(i + 1).padStart(2, '0')
      return session({ date: `2026-06-${day}`, unified_load: 100 })
    })
    const series = acwrSeries(sessions, '2026-06-28', 1)
    expect(series[0].ratio).toBeCloseTo(1.0, 6)
  })
})

describe('strengthHistories', () => {
  it('keeps the best estimated 1RM per exercise per date', () => {
    const sessions = [
      session({
        date: '2026-06-01',
        strength_sets: [
          strengthSet('e1', 'Bench Press', 100, 5), // mean ~114.58
          strengthSet('e1', 'Bench Press', 80, 5), // mean ~91.67, lower estimate
        ],
      }),
      session({
        date: '2026-06-08',
        strength_sets: [strengthSet('e1', 'Bench Press', 105, 5)],
      }),
    ]
    const histories = strengthHistories(sessions)
    expect(histories).toHaveLength(1)
    expect(histories[0].name).toBe('Bench Press')
    expect(histories[0].points).toHaveLength(2)
    expect(histories[0].points[0].value).toBeCloseTo(114.5833, 3)
    expect(histories[0].points[1].value).toBeGreaterThan(histories[0].points[0].value)
  })

  it('skips sets with reps outside the 1RM formula domain', () => {
    const sessions = [
      session({
        date: '2026-06-01',
        strength_sets: [strengthSet('e1', 'Deadlift', 60, 40)],
      }),
    ]
    expect(strengthHistories(sessions)).toHaveLength(0)
  })
})

describe('paceHistory', () => {
  it('returns best (lowest) pace per date for the requested sport', () => {
    const sessions = [
      session({
        date: '2026-06-01',
        sport: 'run',
        duration_min: 30,
        cardio_details: { session_id: 's', distance_m: 6000 }, // 5:00/km
      }),
      session({
        date: '2026-06-01',
        sport: 'run',
        duration_min: 30,
        cardio_details: { session_id: 's', distance_m: 5000 }, // 6:00/km
      }),
      session({ date: '2026-06-02', sport: 'swim', duration_min: 30 }),
    ]
    const history = paceHistory(sessions, 'run')
    expect(history).toEqual([{ date: '2026-06-01', value: 300 }])
  })
})

describe('computePRs', () => {
  it('finds best 1RM per exercise, best paces and distances, and flags recent PRs', () => {
    const sessions = [
      session({
        date: '2026-06-30',
        strength_sets: [strengthSet('e1', 'Squat', 140, 3)],
      }),
      session({
        date: '2026-05-01',
        sport: 'run',
        duration_min: 25,
        cardio_details: { session_id: 's', distance_m: 5000 },
      }),
    ]
    const prs = computePRs(sessions, '2026-07-03')
    const squat = prs.find((p) => p.label.includes('Squat'))
    expect(squat).toBeDefined()
    expect(squat!.isNew).toBe(true) // 3 days ago
    const pace = prs.find((p) => p.label.includes('run pace'))
    expect(pace).toBeDefined()
    expect(pace!.value).toBe('5:00 /km')
    expect(pace!.isNew).toBe(false) // 2 months ago
  })

  it('returns empty for no sessions', () => {
    expect(computePRs([], '2026-07-03')).toEqual([])
  })
})
