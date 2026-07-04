import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Chip, Field, Input, Select, Spinner } from '../../components/ui'
import { sportColorClass } from '../../components/sportColors'
import { SportIcon } from '../../components/sportIcons'
import { todayLocalISO } from '../../lib/dates'
import { formatMinSec } from '../../lib/format'
import { paceSecPer100m, paceSecPerKm } from '../../lib/scoring'
import { useRoutines, type RoutineWithSets } from '../routines/hooks'
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

/**
 * Effort is stored as RPE (0-10) in the DB, but picked from four
 * plain-language levels — a slider over an ambiguous scale helps nobody.
 */
const EFFORT_LEVELS = [
  { rpe: 3, label: 'Easy', hint: 'could do lots more' },
  { rpe: 5, label: 'Moderate', hint: 'breathing harder' },
  { rpe: 7, label: 'Hard', hint: 'a few reps in the tank' },
  { rpe: 9, label: 'Max effort', hint: 'nothing left' },
] as const

const DURATION_PRESETS = [30, 45, 60, 90] as const

const DISTANCE_PRESETS: Record<'run' | 'swim', number[]> = {
  run: [5, 10, 21.1], // km
  swim: [500, 1000, 1500, 2000], // m
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
  const { data: routines } = useRoutines()
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
            rpe: null as number | null,
            notes: '',
            sets: [] as SetRow[],
            distance: '',
          },
    [existing],
  )

  const [sport, setSport] = useState<Sport>(initial.sport)
  const [date, setDate] = useState(initial.date)
  const [duration, setDuration] = useState(initial.duration)
  const [customDuration, setCustomDuration] = useState(
    initial.duration !== '' && !DURATION_PRESETS.some((p) => String(p) === initial.duration),
  )
  const [rpe, setRpe] = useState<number | null>(initial.rpe)
  const [notes, setNotes] = useState(initial.notes)
  const [sets, setSets] = useState<SetRow[]>(initial.sets)
  const [distance, setDistance] = useState(initial.distance)
  const [appliedRoutineId, setAppliedRoutineId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const isEdit = !!existing
  const busy = createSession.isPending || updateSession.isPending
  const meta = sportMeta[sport]

  // Live pace preview while duration + distance are both valid.
  const pacePreview = useMemo(() => {
    if (!meta.distanceUnit) return null
    const mins = Number(duration)
    const raw = Number(distance)
    if (!Number.isFinite(mins) || mins <= 0 || !Number.isFinite(raw) || raw <= 0) return null
    const metres = meta.distanceUnit === 'km' ? raw * 1000 : raw
    return sport === 'run'
      ? `${formatMinSec(paceSecPerKm(mins * 60, metres))} /km`
      : `${formatMinSec(paceSecPer100m(mins * 60, metres))} /100m`
  }, [meta.distanceUnit, sport, duration, distance])

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

  function applyRoutine(routine: RoutineWithSets) {
    setSets(
      routine.routine_sets
        .slice()
        .sort((a, b) => a.set_order - b.set_order)
        .map((rs) => ({
          key: nextKey++,
          exerciseId: rs.exercise_id,
          weightKg: rs.weight_kg == null ? '' : String(rs.weight_kg),
          reps: String(rs.reps),
        })),
    )
    setAppliedRoutineId(routine.id)
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
      setFormError('Pick a session length (or enter one between 1 and 1440 minutes).')
      return
    }

    if (rpe === null) {
      setFormError('Pick an effort level.')
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
      navigate('/sessions')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  const effortMatchesLevel = rpe !== null && EFFORT_LEVELS.some((l) => l.rpe === rpe)

  return (
    <section className="mx-auto max-w-xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isEdit ? 'Edit session' : 'Log session'}
        </h1>
        <p className="mt-1 text-sm text-ink-dim">
          Effort × minutes gives every sport the same load scale.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div role="tablist" className="grid grid-cols-3 gap-2">
          {SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              disabled={isEdit && s !== sport}
              onClick={() => setSport(s)}
              className={`flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border text-sm font-medium transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40 ${
                sport === s
                  ? `border-ink bg-panel ${sportColorClass[s]}`
                  : 'border-line bg-panel text-ink-faint hover:border-ink-faint hover:text-ink-dim'
              }`}
            >
              <SportIcon sport={s} className="size-8" />
              <span className={sport === s ? 'text-ink' : ''}>{sportMeta[s].label}</span>
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
        </div>

        <Field label="Session length" hint="minutes — feeds your injury-risk load">
          <div className="flex flex-wrap items-center gap-2">
            {DURATION_PRESETS.map((p) => (
              <Chip
                key={p}
                selected={!customDuration && duration === String(p)}
                onClick={() => {
                  setDuration(String(p))
                  setCustomDuration(false)
                }}
                className="w-14"
              >
                {p}
              </Chip>
            ))}
            <Chip
              selected={customDuration}
              onClick={() => {
                setCustomDuration(true)
                setDuration('')
              }}
            >
              Custom
            </Chip>
            {customDuration && (
              <Input
                type="number"
                aria-label="Duration in minutes"
                min={1}
                max={1440}
                step="1"
                inputMode="numeric"
                placeholder="75"
                autoFocus
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="!h-10 !w-24"
              />
            )}
          </div>
        </Field>

        <Field label="Effort" hint="how hard the whole session felt">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EFFORT_LEVELS.map((level) => (
              <Chip
                key={level.rpe}
                selected={rpe === level.rpe}
                onClick={() => setRpe(level.rpe)}
                className="flex-col !items-start px-3 py-2 text-left"
              >
                <span className="text-sm font-semibold">{level.label}</span>
                <span
                  className={`text-[11px] font-normal ${
                    rpe === level.rpe ? 'text-white/70' : 'text-ink-faint'
                  }`}
                >
                  {level.hint}
                </span>
              </Chip>
            ))}
          </div>
          {isEdit && rpe !== null && !effortMatchesLevel && (
            <p className="mt-1.5 text-xs text-ink-faint">
              Saved effort is {rpe}/10 — pick a level above to change it.
            </p>
          )}
        </Field>

        {meta.distanceUnit && (
          <Field label="Distance" hint={pacePreview ? `pace ${pacePreview}` : meta.distanceUnit}>
            <div className="flex flex-wrap items-center gap-2">
              {DISTANCE_PRESETS[sport as 'run' | 'swim'].map((p) => (
                <Chip
                  key={p}
                  selected={distance === String(p)}
                  onClick={() => setDistance(String(p))}
                >
                  {p}
                  {meta.distanceUnit === 'km' ? ' km' : ' m'}
                </Chip>
              ))}
              <Input
                type="number"
                aria-label={`Distance in ${meta.distanceUnit === 'km' ? 'kilometres' : 'metres'}`}
                required
                min={meta.distanceUnit === 'km' ? 0.1 : 25}
                step="any"
                inputMode="decimal"
                placeholder={meta.distanceUnit === 'km' ? '8.5' : '1500'}
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
                className="!h-10 !w-28"
              />
            </div>
          </Field>
        )}

        {sport === 'strength' && (
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-dim">
              Sets
            </legend>

            {routines && routines.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-faint">Start from:</span>
                {routines.map((r) => (
                  <Chip
                    key={r.id}
                    selected={appliedRoutineId === r.id}
                    onClick={() => applyRoutine(r)}
                    className="!min-h-8 px-2.5 text-xs"
                  >
                    {r.name}
                  </Chip>
                ))}
              </div>
            )}

            {sets.length === 0 && (
              <p className="rounded-lg border border-dashed border-line bg-panel px-4 py-6 text-center text-sm text-ink-faint">
                No sets yet. Sets power your 1RM progress tracking.
                {(!routines || routines.length === 0) && (
                  <>
                    {' '}
                    Tip: save your usual workout as a{' '}
                    <Link to="/routines" className="underline hover:text-ink">
                      routine
                    </Link>{' '}
                    and prefill it next time.
                  </>
                )}
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
                    className="!w-24 shrink-0"
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
                    className="!w-20 shrink-0"
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
            className="w-full rounded-lg border border-line bg-panel px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-accent focus:outline-none"
          />
        </Field>

        {formError && <Alert kind="error">{formError}</Alert>}

        <div className="flex gap-3">
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? <Spinner /> : isEdit ? 'Save changes' : 'Log session'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/sessions')}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  )
}
