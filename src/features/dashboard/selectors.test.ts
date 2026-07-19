import { describe, expect, it } from 'vitest'
import type { SessionWithDetails } from '../sessions/hooks'
import {
  acwrSeries,
  calendarWeeks,
  computePRs,
  dailyLoadSeries,
  paceHistory,
  speedHistory,
  strengthHistories,
  weeklyDistanceKm,
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
  it('returns best (lowest) running pace per date', () => {
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
      session({ date: '2026-06-02', sport: 'bike', duration_min: 30 }),
    ]
    const history = paceHistory(sessions)
    expect(history).toEqual([{ date: '2026-06-01', value: 300 }])
  })
})

describe('speedHistory', () => {
  it('returns best (highest) cycling speed per date, ignoring non-bike sports', () => {
    const sessions = [
      session({
        date: '2026-06-01',
        sport: 'bike',
        duration_min: 40,
        cardio_details: { session_id: 's', distance_m: 20000 }, // 30 km/h
      }),
      session({
        date: '2026-06-01',
        sport: 'bike',
        duration_min: 40,
        cardio_details: { session_id: 's', distance_m: 10000 }, // 15 km/h, slower
      }),
      session({
        date: '2026-06-02',
        sport: 'run',
        duration_min: 30,
        cardio_details: { session_id: 's', distance_m: 6000 },
      }),
    ]
    const history = speedHistory(sessions)
    expect(history).toEqual([{ date: '2026-06-01', value: 30 }])
  })
})

describe('computePRs', () => {
  it('reports the heaviest real set per exercise, best paces and distances, and flags recent PRs', () => {
    const sessions = [
      session({
        date: '2026-06-30',
        strength_sets: [
          strengthSet('e1', 'Squat', 140, 3),
          strengthSet('e1', 'Squat', 120, 8), // higher est. 1RM would pick this; real record is 140
        ],
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
    expect(squat!.value).toBe('140 kg')
    expect(squat!.date).toBe('2026-06-30')
    expect(squat!.isNew).toBe(true) // 3 days ago
    const pace = prs.find((p) => p.label.includes('run pace'))
    expect(pace).toBeDefined()
    expect(pace!.value).toBe('5:00 /km')
    expect(pace!.isNew).toBe(false) // 2 months ago
  })

  it('keeps the earliest date the record weight was lifted', () => {
    const sessions = [
      session({ date: '2026-06-10', strength_sets: [strengthSet('e1', 'Bench Press', 60, 5)] }),
      session({ date: '2026-06-03', strength_sets: [strengthSet('e1', 'Bench Press', 60, 8)] }),
      session({ date: '2026-06-17', strength_sets: [strengthSet('e1', 'Bench Press', 55, 8)] }),
    ]
    const prs = computePRs(sessions, '2026-07-03')
    const bench = prs.find((p) => p.label.includes('Bench Press'))
    expect(bench!.value).toBe('60 kg')
    expect(bench!.date).toBe('2026-06-03') // first time the record was set
  })

  it('returns empty for no sessions', () => {
    expect(computePRs([], '2026-07-03')).toEqual([])
  })
})

describe('calendarWeeks', () => {
  // 2026-07-19 is a Sunday; the 2 weeks ending there run Mon 07-06 → Sun 07-19.
  it('builds Monday-first weeks ending with the week of asOf', () => {
    const weeks = calendarWeeks([], '2026-07-19', 2)
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0].date).toBe('2026-07-06')
    expect(weeks[0][6].date).toBe('2026-07-12')
    expect(weeks[1][0].date).toBe('2026-07-13')
    expect(weeks[1][6].date).toBe('2026-07-19')
  })

  it('pads days after asOf when asOf is mid-week', () => {
    const weeks = calendarWeeks([], '2026-07-15', 1) // Wednesday
    expect(weeks[0][2]).toMatchObject({ date: '2026-07-15', inFuture: false })
    expect(weeks[0][3]).toMatchObject({ date: '2026-07-16', inFuture: true })
  })

  it('collects unique sports in fixed order and sums the load per day', () => {
    const sessions = [
      session({ date: '2026-07-15', sport: 'run', unified_load: 100 }),
      session({ date: '2026-07-15', sport: 'strength', unified_load: 200 }),
      session({ date: '2026-07-15', sport: 'run', unified_load: 50 }),
      session({ date: '2026-07-06', sport: 'bike', unified_load: 80 }),
    ]
    const weeks = calendarWeeks(sessions, '2026-07-19', 2)
    expect(weeks[1][2]).toMatchObject({
      date: '2026-07-15',
      sports: ['strength', 'run'],
      load: 350,
    })
    expect(weeks[0][0]).toMatchObject({ date: '2026-07-06', sports: ['bike'], load: 80 })
    expect(weeks[0][1].sports).toEqual([])
  })
})

describe('weeklyDistanceKm', () => {
  it('sums run and bike km for the Monday-first week containing asOf', () => {
    const sessions = [
      session({
        date: '2026-07-13',
        sport: 'run',
        cardio_details: { session_id: 's', distance_m: 7000 },
      }),
      session({
        date: '2026-07-15',
        sport: 'run',
        cardio_details: { session_id: 's', distance_m: 5000 },
      }),
      session({
        date: '2026-07-17',
        sport: 'bike',
        cardio_details: { session_id: 's', distance_m: 20000 },
      }),
      // previous week — excluded
      session({
        date: '2026-07-12',
        sport: 'run',
        cardio_details: { session_id: 's', distance_m: 6000 },
      }),
      // strength has no distance
      session({ date: '2026-07-14', sport: 'strength' }),
    ]
    expect(weeklyDistanceKm(sessions, '2026-07-19')).toEqual({ runKm: 12, bikeKm: 20 })
  })

  it('returns zeros for an empty week', () => {
    expect(weeklyDistanceKm([], '2026-07-19')).toEqual({ runKm: 0, bikeKm: 0 })
  })
})
