import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Field, Input, Select, Spinner } from '../../components/ui'
import { todayLocalISO } from '../../lib/dates'
import {
  useCreateExercise,
  useCreateSession,
  useExercises,
  useSession,
  useUpdateSession,
  type SessionDraft,
  type SessionWithDetails,
} from './hooks'
import { SPORTS, sportMeta, type Sport } from './sportMeta'

interface SetRow {
  key: number
  exerciseId: string
  weightKg: string
  reps: string
}

let nextKey = 0

const RPE_HINTS: Record<number, string> = {
  0: 'rest',
  1: 'very easy',
  2: 'easy',
  3: 'moderate',
  4: 'somewhat hard',
  5: 'hard',
  6: 'hard+',
  7: 'very hard',
  8: 'very hard+',
  9: 'near maximal',
  10: 'maximal',
}

function draftFromSession(s: SessionWithDetails): {
  sport: Sport
  date: string
  duration: string
  rpe: number
  notes: string
  sets: SetRow[]
  distance: string
} {
  const unit = sportMeta[s.sport].distanceUnit
  const dist = s.cardio_details?.distance_m
  return {
    sport: s.sport,
    date: s.date,
    duration: String(s.duration_min),
    rpe: s.rpe,
    notes: s.notes ?? '',
    sets: s.strength_sets
      .slice()
      .sort((a, b) => a.set_order - b.set_order)
      .map((set) => ({
        key: nextKey++,
        exerciseId: set.exercise_id,
        weightKg: String(set.weight_kg),
        reps: String(set.reps),
      })),
    distance: dist == null ? '' : unit === 'km' ? String(dist / 1000) : String(dist),
  }
}

export function SessionFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const { data: existing, isLoading: loadingExisting } = useSession(id)

  if (isEdit && loadingExisting) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    )
  }
  if (isEdit && !existing) {
    return <Alert kind="error">Session not found.</Alert>
  }
  return <SessionForm existing={existing} />
}

function SessionForm({ existing }: { existing?: SessionWithDetails }) {
  const navigate = useNavigate()
  const { data: exercises } = useExercises()
  const createSession = useCreateSession()
  const updateSession = useUpdateSession()
  const createExercise = useCreateExercise()

  const initial = useMemo(
    () =>
      existing
        ? draftFromSession(existing)
        : {
            sport: 'strength' as Sport,
            date: todayLocalISO(),
            duration: '',
            rpe: 7,
            notes: '',
            sets: [] as SetRow[],
            distance: '',
          },
    [existing],
  )

  const [sport, setSport] = useState<Sport>(initial.sport)
  const [date, setDate] = useState(initial.date)
  const [duration, setDuration] = useState(initial.duration)
  const [rpe, setRpe] = useState(initial.rpe)
  const [notes, setNotes] = useState(initial.notes)
  const [sets, setSets] = useState<SetRow[]>(initial.sets)
  const [distance, setDistance] = useState(initial.distance)
  const [formError, setFormError] = useState<string | null>(null)

  const isEdit = !!existing
  const busy = createSession.isPending || updateSession.isPending
  const meta = sportMeta[sport]

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
    const name = window.prompt('New exercise name:')?.trim()
    if (!name) return
    try {
      const ex = await createExercise.mutateAsync(name)
      updateSet(key, { exerciseId: ex.id })
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Could not create exercise')
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)

    const durationMin = Number(duration)
    if (!Number.isFinite(durationMin) || durationMin <= 0 || durationMin > 1440) {
      setFormError('Duration must be between 1 and 1440 minutes.')
      return
    }

    let distanceM: number | null = null
    if (meta.distanceUnit) {
      const raw = Number(distance)
      if (!Number.isFinite(raw) || raw <= 0) {
        setFormError('Distance must be a positive number.')
        return
      }
      distanceM = Math.round(meta.distanceUnit === 'km' ? raw * 1000 : raw)
    }

    const parsedSets = sets.map((s) => ({
      exerciseId: s.exerciseId,
      weightKg: Number(s.weightKg),
      reps: Number(s.reps),
    }))
    if (sport === 'strength') {
      for (const s of parsedSets) {
        if (!s.exerciseId) {
          setFormError('Every set needs an exercise.')
          return
        }
        if (!Number.isFinite(s.weightKg) || s.weightKg < 0) {
          setFormError('Set weight must be 0 or more (0 = bodyweight).')
          return
        }
        if (!Number.isInteger(s.reps) || s.reps < 1 || s.reps > 100) {
          setFormError('Set reps must be a whole number between 1 and 100.')
          return
        }
      }
    }

    const draft: SessionDraft = {
      sport,
      date,
      durationMin,
      rpe,
      notes,
      sets: sport === 'strength' ? parsedSets : [],
      distanceM: sport === 'strength' ? null : distanceM,
    }

    try {
      if (isEdit) {
        await updateSession.mutateAsync({ id: existing.id, draft })
      } else {
        await createSession.mutateAsync(draft)
      }
      navigate('/')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  return (
    <section className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isEdit ? 'Edit session' : 'Log session'}
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          RPE × minutes gives every sport the same load scale.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-lg bg-panel-2 p-1">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              disabled={isEdit && s !== sport}
              onClick={() => setSport(s)}
              className={`h-10 rounded-md text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                sport === s ? 'bg-panel text-ink' : 'text-ink-dim hover:text-ink'
              }`}
            >
              {sportMeta[s].label}
            </button>
          ))}
        </div>
        {isEdit && (
          <p className="text-xs text-ink-faint">
            Sport can't be changed after logging — delete and re-log instead.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Date">
            <Input
              type="date"
              required
              max={todayLocalISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Duration" hint="minutes">
            <Input
              type="number"
              required
              min={1}
              max={1440}
              step="1"
              inputMode="numeric"
              placeholder="60"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
        </div>

        <Field label={`Effort (RPE) — ${rpe}`} hint={RPE_HINTS[Math.round(rpe)]}>
          <input
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={rpe}
            onChange={(e) => setRpe(Number(e.target.value))}
            className="h-11 w-full accent-accent"
          />
        </Field>

        {meta.distanceUnit && (
          <Field label="Distance" hint={meta.distanceUnit}>
            <Input
              type="number"
              required
              min={meta.distanceUnit === 'km' ? 0.1 : 25}
              step="any"
              inputMode="decimal"
              placeholder={meta.distanceUnit === 'km' ? '8.5' : '1500'}
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
            />
          </Field>
        )}

        {sport === 'strength' && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-dim">
              Sets
            </legend>
            {sets.length === 0 && (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-faint">
                No sets yet. Sets power your 1RM progress tracking.
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
                    aria-label="Weight (kg)"
                    type="number"
                    required
                    min={0}
                    max={1000}
                    step="0.5"
                    inputMode="decimal"
                    placeholder="kg"
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
        )}

        <Field label="Notes" hint="optional">
          <textarea
            rows={2}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="How did it feel?"
            className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-accent focus:outline-none"
          />
        </Field>

        {formError && <Alert kind="error">{formError}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? <Spinner /> : isEdit ? 'Save changes' : 'Log session'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/')}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
