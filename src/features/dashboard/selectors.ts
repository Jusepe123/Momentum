/**
 * Pure derivations from session data to chart-ready series.
 * No I/O here — everything is testable with plain fixtures.
 */
import { formatDistance, formatMinSec } from '../../lib/format'
import {
  acwr,
  epochDay,
  estimate1RM,
  paceSecPer100m,
  paceSecPerKm,
  sessionLoad,
  type MetricPoint,
  type SessionLoadPoint,
} from '../../lib/scoring'
import type { SessionWithDetails } from '../sessions/hooks'

const MS_PER_DAY = 86_400_000

function isoFromEpochDay(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10)
}

export function toLoadPoints(sessions: SessionWithDetails[]): SessionLoadPoint[] {
  return sessions.map((s) => ({
    date: s.date,
    load: s.unified_load ?? sessionLoad(s.rpe, s.duration_min),
  }))
}

/** Daily load sums for the `days` days ending at asOf, zero-filled. */
export function dailyLoadSeries(
  sessions: SessionWithDetails[],
  asOf: string,
  days: number,
): { date: string; load: number }[] {
  const end = epochDay(asOf)
  const start = end - days + 1
  const byDay = new Map<number, number>()
  for (const p of toLoadPoints(sessions)) {
    const day = epochDay(p.date)
    if (day < start || day > end) continue
    byDay.set(day, (byDay.get(day) ?? 0) + p.load)
  }
  const out: { date: string; load: number }[] = []
  for (let day = start; day <= end; day++) {
    out.push({ date: isoFromEpochDay(day), load: byDay.get(day) ?? 0 })
  }
  return out
}

/** One ACWR ratio per day for the `days` days ending at asOf. */
export function acwrSeries(
  sessions: SessionWithDetails[],
  asOf: string,
  days: number,
): { date: string; ratio: number | null }[] {
  const points = toLoadPoints(sessions)
  const end = epochDay(asOf)
  const out: { date: string; ratio: number | null }[] = []
  for (let day = end - days + 1; day <= end; day++) {
    const date = isoFromEpochDay(day)
    out.push({ date, ratio: acwr(points, date).ratio })
  }
  return out
}

export interface ExerciseHistory {
  exerciseId: string
  name: string
  /** Best estimated 1RM (mean of Epley/Brzycki) per date, ascending. */
  points: MetricPoint[]
}

const MAX_1RM_REPS = 36

export function strengthHistories(sessions: SessionWithDetails[]): ExerciseHistory[] {
  // exerciseId -> date -> best 1RM estimate
  const byExercise = new Map<string, { name: string; byDate: Map<string, number> }>()
  for (const s of sessions) {
    for (const set of s.strength_sets) {
      if (set.reps < 1 || set.reps > MAX_1RM_REPS || set.weight_kg <= 0) continue
      const est = estimate1RM(set.weight_kg, set.reps).mean
      const entry = byExercise.get(set.exercise_id) ?? {
        name: set.exercise?.name ?? 'Unknown exercise',
        byDate: new Map<string, number>(),
      }
      const prev = entry.byDate.get(s.date)
      if (prev === undefined || est > prev) entry.byDate.set(s.date, est)
      byExercise.set(set.exercise_id, entry)
    }
  }
  return [...byExercise.entries()]
    .map(([exerciseId, { name, byDate }]) => ({
      exerciseId,
      name,
      points: [...byDate.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => epochDay(a.date) - epochDay(b.date)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Best (lowest) pace per date: sec/km for run, sec/100m for swim. */
export function paceHistory(
  sessions: SessionWithDetails[],
  sport: 'run' | 'swim',
): MetricPoint[] {
  const byDate = new Map<string, number>()
  for (const s of sessions) {
    if (s.sport !== sport || !s.cardio_details) continue
    const durationSec = s.duration_min * 60
    const pace =
      sport === 'run'
        ? paceSecPerKm(durationSec, s.cardio_details.distance_m)
        : paceSecPer100m(durationSec, s.cardio_details.distance_m)
    const prev = byDate.get(s.date)
    if (prev === undefined || pace < prev) byDate.set(s.date, pace)
  }
  return [...byDate.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => epochDay(a.date) - epochDay(b.date))
}

export interface PersonalRecord {
  label: string
  value: string
  date: string
  isNew: boolean
}

const NEW_PR_WINDOW_DAYS = 14

export function computePRs(sessions: SessionWithDetails[], asOf: string): PersonalRecord[] {
  const prs: PersonalRecord[] = []
  const isNew = (date: string) => epochDay(asOf) - epochDay(date) <= NEW_PR_WINDOW_DAYS

  for (const h of strengthHistories(sessions)) {
    const best = h.points.reduce((a, b) => (b.value > a.value ? b : a))
    prs.push({
      label: `${h.name} est. 1RM`,
      value: `${best.value.toFixed(1)} kg`,
      date: best.date,
      isNew: isNew(best.date),
    })
  }

  for (const sport of ['run', 'swim'] as const) {
    const paces = paceHistory(sessions, sport)
    if (paces.length > 0) {
      const best = paces.reduce((a, b) => (b.value < a.value ? b : a))
      prs.push({
        label: `Fastest ${sport} pace`,
        value: `${formatMinSec(best.value)} ${sport === 'run' ? '/km' : '/100m'}`,
        date: best.date,
        isNew: isNew(best.date),
      })
    }
    const distances = sessions.filter((s) => s.sport === sport && s.cardio_details)
    if (distances.length > 0) {
      const best = distances.reduce((a, b) =>
        b.cardio_details!.distance_m > a.cardio_details!.distance_m ? b : a,
      )
      prs.push({
        label: `Longest ${sport}`,
        value: formatDistance(best.cardio_details!.distance_m),
        date: best.date,
        isNew: isNew(best.date),
      })
    }
  }

  return prs.sort((a, b) => epochDay(b.date) - epochDay(a.date))
}
