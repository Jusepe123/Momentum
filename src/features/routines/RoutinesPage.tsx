import { Link } from 'react-router-dom'
import { Alert, Button } from '../../components/ui'
import { useDeleteRoutine, useRoutines, type RoutineWithSets } from './hooks'

/** "Bench Press 4×8 · Overhead Press 3×10" — grouped in first-seen order. */
function summarize(routine: RoutineWithSets): string {
  const groups: { name: string; reps: number[] }[] = []
  const byExercise = new Map<string, { name: string; reps: number[] }>()
  for (const set of routine.routine_sets.slice().sort((a, b) => a.set_order - b.set_order)) {
    const name = set.exercise?.name ?? 'Unknown exercise'
    let group = byExercise.get(set.exercise_id)
    if (!group) {
      group = { name, reps: [] }
      byExercise.set(set.exercise_id, group)
      groups.push(group)
    }
    group.reps.push(set.reps)
  }
  return groups
    .map((g) =>
      g.reps.every((r) => r === g.reps[0])
        ? `${g.name} ${g.reps.length}×${g.reps[0]}`
        : `${g.name} ×${g.reps.length}`,
    )
    .join(' · ')
}

function RoutineRow({ routine }: { routine: RoutineWithSets }) {
  const del = useDeleteRoutine()

  function handleDelete() {
    if (window.confirm(`Delete routine "${routine.name}"? Logged sessions keep their data.`)) {
      del.mutate(routine.id)
    }
  }

  return (
    <li className="px-4 transition-colors duration-200 hover:bg-panel-2/50">
      <div className="group flex items-center gap-3 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{routine.name}</p>
          <p className="truncate text-xs text-ink-dim">
            {routine.routine_sets.length === 0 ? 'No sets yet' : summarize(routine)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
          <Link
            to={`/routines/${routine.id}/edit`}
            className="rounded-md px-2.5 py-1.5 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={del.isPending}
            className="rounded-md px-2.5 py-1.5 text-sm text-danger/80 transition-colors hover:text-danger"
          >
            Delete
          </button>
        </div>
      </div>
      {del.isError && (
        <p role="alert" className="pb-2 text-xs text-danger">
          Delete failed: {del.error.message}
        </p>
      )}
    </li>
  )
}

export function RoutinesPage() {
  const { data: routines, isLoading, error } = useRoutines()

  return (
    <section>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Routines</h1>
          <p className="mt-1 text-sm text-ink-dim">
            Your usual workouts, saved — one tap prefills a strength session.
          </p>
        </div>
        <Link to="/routines/new">
          <Button>New routine</Button>
        </Link>
      </header>

      {error && <Alert kind="error">Could not load routines: {error.message}</Alert>}

      {isLoading && (
        <ul
          className="divide-y divide-line rounded-xl border border-line bg-panel"
          aria-label="Loading routines"
        >
          {[0, 1].map((i) => (
            <li key={i} className="h-[64px] animate-pulse" />
          ))}
        </ul>
      )}

      {routines && routines.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center">
          <h2 className="font-display text-lg font-semibold">No routines yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-dim">
            Most people repeat the same workout — save it once (e.g. “Push day”: bench 4×8,
            overhead press 3×10) and logging becomes a two-tap job.
          </p>
          <Link to="/routines/new" className="mt-6 inline-block">
            <Button>Create your first routine</Button>
          </Link>
        </div>
      )}

      {routines && routines.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {routines.map((r) => (
            <RoutineRow key={r.id} routine={r} />
          ))}
        </ul>
      )}
    </section>
  )
}
