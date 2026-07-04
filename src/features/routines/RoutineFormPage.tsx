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

interface SetRow {
  key: number
  exerciseId: string
  weightKg: string
  reps: string
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
      sets: (existing?.routine_sets ?? [])
        .slice()
        .sort((a, b) => a.set_order - b.set_order)
        .map((s) => ({
          key: nextKey++,
          exerciseId: s.exercise_id,
          weightKg: s.weight_kg == null ? '' : String(s.weight_kg),
          reps: String(s.reps),
        })),
    }),
    [existing],
  )

  const [name, setName] = useState(initial.name)
  const [sets, setSets] = useState<SetRow[]>(initial.sets)
  const [formError, setFormError] = useState<string | null>(null)

  const isEdit = !!existing
  const busy = createRoutine.isPending || updateRoutine.isPending

  function addSet() {
    const prev = sets[sets.length - 1]
    setSets([
      ...sets,
      {
        key: nextKey++,
        exerciseId: prev?.exerciseId ?? exercises?.[0]?.id ?? '',
        weightKg: prev?.weightKg ?? '',
        reps: prev?.reps ?? '',
      },
    ])
  }

  function updateSet(key: number, patch: Partial<SetRow>) {
    setSets(sets.map((s) => (s.key === key ? { ...s, ...patch } : s)))
  }

  async function addCustomExercise(key: number) {
    const exerciseName = window.prompt('New exercise name:')?.trim()
    if (!exerciseName) return
    try {
      const ex = await createExercise.mutateAsync(exerciseName)
      updateSet(key, { exerciseId: ex.id })
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

    const parsedSets = sets.map((s) => ({
      exerciseId: s.exerciseId,
      weightKg: s.weightKg.trim() === '' ? null : Number(s.weightKg),
      reps: Number(s.reps),
    }))
    for (const s of parsedSets) {
      if (!s.exerciseId) {
        setFormError('Every set needs an exercise.')
        return
      }
      if (s.weightKg !== null && (!Number.isFinite(s.weightKg) || s.weightKg < 0 || s.weightKg > 1000)) {
        setFormError('Target weight must be between 0 and 1000 kg (or left empty).')
        return
      }
      if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 100) {
        setFormError('Set reps must be a whole number between 1 and 100.')
        return
      }
    }

    const draft: RoutineDraft = { name: trimmed, sets: parsedSets }

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
          A template of exercises and reps — target weight is optional.
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
            Sets
          </legend>
          {sets.length === 0 && (
            <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-ink-faint">
              Add the sets you always do — exercise and reps, weight if you want a target.
            </p>
          )}
          <div className="space-y-2">
            {sets.map((s, i) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-right font-display text-xs text-ink-faint">
                  {i + 1}
                </span>
                <Select
                  aria-label="Exercise"
                  value={s.exerciseId}
                  onChange={(e) =>
                    e.target.value === '__new__'
                      ? addCustomExercise(s.key)
                      : updateSet(s.key, { exerciseId: e.target.value })
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
                  aria-label="Target weight (kg, optional)"
                  type="number"
                  min={0}
                  max={1000}
                  step="0.5"
                  inputMode="decimal"
                  placeholder="kg?"
                  value={s.weightKg}
                  onChange={(e) => updateSet(s.key, { weightKg: e.target.value })}
                  className="w-24"
                />
                <Input
                  aria-label="Reps"
                  type="number"
                  required
                  min={1}
                  max={100}
                  step="1"
                  inputMode="numeric"
                  placeholder="reps"
                  value={s.reps}
                  onChange={(e) => updateSet(s.key, { reps: e.target.value })}
                  className="w-20"
                />
                <button
                  type="button"
                  aria-label={`Remove set ${i + 1}`}
                  onClick={() => setSets(sets.filter((x) => x.key !== s.key))}
                  className="shrink-0 rounded-md px-2 py-1.5 text-sm text-ink-faint transition-colors hover:text-danger"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" onClick={addSet} className="mt-2 w-full">
            + Add set
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
