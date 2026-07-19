/** The top set of an exercise the last time it was trained. */
export interface LastLift {
  weightKg: number
  reps: number
  date: string
}

interface SessionRow {
  date: string
  strength_sets: { exercise_id: string; weight_kg: number; reps: number }[]
}

/**
 * Reduce recent strength sessions (sorted date DESC — the query's job) to each
 * exercise's most recent top set: heaviest weight, ties broken by more reps.
 * Feeds the "Last time: 50 kg × 8" hint in the strength form.
 */
export function reduceLastLifts(rows: SessionRow[]): Record<string, LastLift> {
  const out: Record<string, LastLift> = {}
  for (const row of rows) {
    const bestThisRow: Record<string, LastLift> = {}
    for (const s of row.strength_sets) {
      if (s.exercise_id in out) continue // already claimed by a more recent session
      const cur = bestThisRow[s.exercise_id]
      if (
        !cur ||
        s.weight_kg > cur.weightKg ||
        (s.weight_kg === cur.weightKg && s.reps > cur.reps)
      ) {
        bestThisRow[s.exercise_id] = { weightKg: s.weight_kg, reps: s.reps, date: row.date }
      }
    }
    Object.assign(out, bestThisRow)
  }
  return out
}
