import { describe, expect, it } from 'vitest'
import { expandGroups, groupSets, type SetGroup } from './setGroups'

const bench = (weightKg: number | null, reps: number) => ({ exerciseId: 'bench', weightKg, reps })
const squat = (weightKg: number | null, reps: number) => ({ exerciseId: 'squat', weightKg, reps })

describe('groupSets', () => {
  it('collapses consecutive identical sets into one group', () => {
    expect(groupSets([bench(40, 8), bench(40, 8), bench(40, 8)])).toEqual([
      { exerciseId: 'bench', numSets: 3, weightKg: 40, reps: 8 },
    ])
  })

  it('keeps groups separate when exercise, reps, or weight differ', () => {
    expect(groupSets([bench(40, 8), bench(40, 6), squat(60, 6)])).toEqual([
      { exerciseId: 'bench', numSets: 1, weightKg: 40, reps: 8 },
      { exerciseId: 'bench', numSets: 1, weightKg: 40, reps: 6 },
      { exerciseId: 'squat', numSets: 1, weightKg: 60, reps: 6 },
    ])
  })

  it('does not merge non-consecutive identical sets (preserves order)', () => {
    expect(groupSets([bench(40, 8), squat(60, 5), bench(40, 8)])).toEqual([
      { exerciseId: 'bench', numSets: 1, weightKg: 40, reps: 8 },
      { exerciseId: 'squat', numSets: 1, weightKg: 60, reps: 5 },
      { exerciseId: 'bench', numSets: 1, weightKg: 40, reps: 8 },
    ])
  })

  it('treats null target weights as equal', () => {
    expect(groupSets([bench(null, 10), bench(null, 10)])).toEqual([
      { exerciseId: 'bench', numSets: 2, weightKg: null, reps: 10 },
    ])
  })

  it('returns empty for no sets', () => {
    expect(groupSets([])).toEqual([])
  })
})

describe('expandGroups', () => {
  it('emits numSets identical set drafts per group, in order', () => {
    const groups: SetGroup<number>[] = [
      { exerciseId: 'bench', numSets: 2, weightKg: 40, reps: 8 },
      { exerciseId: 'squat', numSets: 1, weightKg: 0, reps: 5 },
    ]
    expect(expandGroups(groups)).toEqual([
      { exerciseId: 'bench', weightKg: 40, reps: 8 },
      { exerciseId: 'bench', weightKg: 40, reps: 8 },
      { exerciseId: 'squat', weightKg: 0, reps: 5 },
    ])
  })

  it('round-trips: expand then group returns the merged groups', () => {
    const groups: SetGroup[] = [
      { exerciseId: 'bench', numSets: 3, weightKg: 42.5, reps: 8 },
      { exerciseId: 'squat', numSets: 4, weightKg: null, reps: 6 },
    ]
    expect(groupSets(expandGroups(groups))).toEqual(groups)
  })
})
