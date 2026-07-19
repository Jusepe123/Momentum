import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Field, Input, Select, Spinner } from '../../components/ui'
import { useCreateExercise, useExercises } from '../sessions/hooks'
import {
  useCreateRoutine,
  useRoutine,
  useUpdateRoutine,
  type RoutineDraft,
  type RoutineWithSets,
} from './hooks'
import { expandGroups, groupSets } from './setGroups'

/** One editor row = N identical sets: exercise, set count, reps, one target weight. */
interface GroupRow {
  key: number
  exerciseId: string
  numSets: string
  reps: string
  weightKg: string
}

let nextKey = 0

export function RoutineFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const { data: existing, isLoading } = useRoutine(id)

  if (isEdit && isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }
  if (isEdit && !existing) {
    return <Alert kind="error">Routine not found.</Alert>
  }
  return <RoutineForm existing={existing} />
}

function RoutineForm({ existing }: { existing?: RoutineWithSets }) {
  const navigate = useNavigate()
  const { data: exercises } = useExercises()
  const createRoutine = useCreateRoutine()
  const updateRoutine = useUpdateRoutine()
  const createExercise = useCreateExercise()

  const initial = useMemo(
    () => ({
      name: existing?.name ?? '',
      groups: groupSets(
        (existing?.routine_sets ?? [])
          .slice()
          .sort((a, b) => a.set_order - b.set_order)
          .map((s) => ({ exerciseId: s.exercise_id, weightKg: s.weight_kg, reps: s.reps })),
      ).map((g) => ({
        key: nextKey++,
        exerciseId: g.exerciseId,
        numSets: String(g.numSets),
        reps: String(g.reps),
        weightKg: g.weightKg == null ? '' : String(g.weightKg),
      })),
    }),
    [existing],
  )

  const [name, setName] = useState(initial.name)
  const [groups, setGroups] = useState<GroupRow[]>(initial.groups)
  const [formError, setFormError] = useState<string | null>(null)

  const isEdit = !!existing
  const busy = createRoutine.isPending || updateRoutine.isPending

  function addGroup() {
    const prev = groups[groups.length - 1]
    setGroups([
      ...groups,
      {
        key: nextKey++,
        exerciseId: prev?.exerciseId ?? exercises?.[0]?.id ?? '',
        numSets: prev?.numSets ?? '3',
        reps: prev?.reps ?? '',
        weightKg: prev?.weightKg ?? '',
      },
    ])
  }

  function updateGroup(key: number, patch: Partial<GroupRow>) {
    setGroups(groups.map((g) => (g.key === key ? { ...g, ...patch } : g)))
  }

  async function addCustomExercise(key: number) {
    const exerciseName = window.prompt('New exercise name:')?.trim()
    if (!exerciseName) return
    try {
      const ex = await createExercise.mutateAsync(exerciseName)
      updateGroup(key, { exerciseId: ex.id })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create exercise')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const trimmed = name.trim()
    if (trimmed.length < 1 || trimmed.length > 80) {
      setFormError('Routine name must be 1–80 characters.')
      return
    }

    const parsedGroups = groups.map((g) => ({
      exerciseId: g.exerciseId,
      numSets: Number(g.numSets),
      reps: Number(g.reps),
      weightKg: g.weightKg.trim() === '' ? null : Number(g.weightKg),
    }))
    for (const g of parsedGroups) {
      if (!g.exerciseId) {
        setFormError('Every exercise row needs an exercise.')
        return
      }
      if (!Number.isInteger(g.numSets) || g.numSets < 1 || g.numSets > 20) {
        setFormError('Sets must be a whole number between 1 and 20.')
        return
      }
      if (!Number.isInteger(g.reps) || g.reps < 1 || g.reps > 100) {
        setFormError('Reps must be a whole number between 1 and 100.')
        return
      }
      if (g.weightKg !== null && (!Number.isFinite(g.weightKg) || g.weightKg < 0 || g.weightKg > 1000)) {
        setFormError('Target weight must be between 0 and 1000 kg (or left empty).')
        return
      }
    }

    const draft: RoutineDraft = { name: trimmed, sets: expandGroups(parsedGroups) }

    try {
      if (isEdit) {
        await updateRoutine.mutateAsync({ id: existing.id, draft })
      } else {
        await createRoutine.mutateAsync(draft)
      }
      navigate('/routines')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isEdit ? 'Edit routine' : 'New routine'}
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Each row is one exercise: sets × reps per set, with an optional target weight applied to
          all its sets.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="Name">
          <Input
            required
            maxLength={80}
            placeholder="Push day"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-dim">
            Exercises
          </legend>
          {groups.length === 0 && (
            <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-ink-faint">
              Add an exercise with its sets × reps — weight if you want a target.
            </p>
          )}
          <div className="space-y-2">
            {groups.map((g, i) => (
              <div key={g.key} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right font-display text-xs text-ink-faint">
                  {i + 1}
                </span>
                <Select
                  aria-label="Exercise"
                  value={g.exerciseId}
                  onChange={(e) =>
                    e.target.value === '__new__'
                      ? addCustomExercise(g.key)
                      : updateGroup(g.key, { exerciseId: e.target.value })
                  }
                  className="flex-1"
                >
                  {exercises?.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                  <option value="__new__">+ New exercise…</option>
                </Select>
                <Input
                  aria-label="Sets"
                  type="number"
                  required
                  min={1}
                  max={20}
                  step="1"
                  inputMode="numeric"
                  placeholder="sets"
                  value={g.numSets}
                  onChange={(e) => updateGroup(g.key, { numSets: e.target.value })}
                  className="!w-16 shrink-0"
                />
                <span aria-hidden className="shrink-0 text-xs text-ink-faint">
                  ×
                </span>
                <Input
                  aria-label="Reps per set"
                  type="number"
                  required
                  min={1}
                  max={100}
                  step="1"
                  inputMode="numeric"
                  placeholder="reps"
                  value={g.reps}
                  onChange={(e) => updateGroup(g.key, { reps: e.target.value })}
                  className="!w-16 shrink-0"
                />
                <Input
                  aria-label="Target weight for all sets (kg, optional)"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.5"
                  inputMode="decimal"
                  placeholder="kg?"
                  value={g.weightKg}
                  onChange={(e) => updateGroup(g.key, { weightKg: e.target.value })}
                  className="!w-20 shrink-0"
                />
                <button
                  type="button"
                  aria-label={`Remove exercise row ${i + 1}`}
                  onClick={() => setGroups(groups.filter((x) => x.key !== g.key))}
                  className="shrink-0 rounded-md px-2 py-1.5 text-sm text-ink-faint transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={addGroup} className="mt-2 w-full">
            + Add exercise
          </Button>
        </fieldset>

        {formError && <Alert kind="error">{formError}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? <Spinner /> : isEdit ? 'Save changes' : 'Create routine'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/routines')}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
