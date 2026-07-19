/**
 * One editor row: N identical sets of an exercise. The DB stays one row per
 * set (routine_sets / strength_sets); groups exist only in the form UI.
 * Weight is `number | null` in routine templates, plain `number` in logged
 * sessions — hence the type parameter.
 */
export interface SetGroup<W = number | null> {
  exerciseId: string
  numSets: number
  weightKg: W
  reps: number
}

interface SetLike<W> {
  exerciseId: string
  weightKg: W
  reps: number
}

/** Collapse consecutive identical sets (same exercise, weight, reps) into groups. */
export function groupSets<W>(sets: SetLike<W>[]): SetGroup<W>[] {
  const groups: SetGroup<W>[] = []
  for (const s of sets) {
    const prev = groups[groups.length - 1]
    if (
      prev &&
      prev.exerciseId === s.exerciseId &&
      prev.weightKg === s.weightKg &&
      prev.reps === s.reps
    ) {
      prev.numSets++
    } else {
      groups.push({ exerciseId: s.exerciseId, numSets: 1, weightKg: s.weightKg, reps: s.reps })
    }
  }
  return groups
}

/** Expand groups back into the flat one-row-per-set shape the API expects. */
export function expandGroups<W>(groups: SetGroup<W>[]): SetLike<W>[] {
  return groups.flatMap((g) =>
    Array.from({ length: g.numSets }, () => ({
      exerciseId: g.exerciseId,
      weightKg: g.weightKg,
      reps: g.reps,
    })),
  )
}
