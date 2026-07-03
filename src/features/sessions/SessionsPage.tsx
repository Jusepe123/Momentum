import { Link } from 'react-router-dom'
import { Alert, Button } from '../../components/ui'
import { paceSecPer100m, paceSecPerKm, volumeLoad } from '../../lib/scoring'
import { formatDate, formatDistance, formatMinSec } from '../../lib/format'
import { useDeleteSession, useSessions, type SessionWithDetails } from './hooks'
import { sportMeta } from './sportMeta'

function sportStat(s: SessionWithDetails): string | null {
  if (s.sport === 'strength') {
    if (s.strength_sets.length === 0) return null
    const vol = volumeLoad(
      s.strength_sets.map((set) => ({ weightKg: set.weight_kg, reps: set.reps })),
    )
    return `${s.strength_sets.length} sets · ${Math.round(vol).toLocaleString('en-US')} kg volume`
  }
  if (!s.cardio_details) return null
  const dist = s.cardio_details.distance_m
  const durationSec = s.duration_min * 60
  const pace =
    s.sport === 'run'
      ? `${formatMinSec(paceSecPerKm(durationSec, dist))} /km`
      : `${formatMinSec(paceSecPer100m(durationSec, dist))} /100m`
  return `${formatDistance(dist)} · ${pace}`
}

function SessionRow({ session }: { session: SessionWithDetails }) {
  const del = useDeleteSession()
  const meta = sportMeta[session.sport]
  const stat = sportStat(session)

  function handleDelete() {
    if (window.confirm('Delete this session? This cannot be undone.')) {
      del.mutate(session.id)
    }
  }

  return (
    <li className="rounded-xl border border-line bg-panel px-4 py-3.5 transition-colors duration-200 hover:border-ink-faint">
      <div className="group flex items-center gap-4">
      <div className="flex h-11 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-panel-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
          {meta.label}
        </span>
        <span className="font-display text-sm font-bold text-accent">
          {session.unified_load !== null ? Math.round(session.unified_load) : '—'}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {formatDate(session.date)}
          <span className="ml-2 text-ink-dim">
            {session.duration_min} min · RPE {session.rpe}
          </span>
        </p>
        <p className="truncate text-sm text-ink-dim">{stat ?? session.notes ?? ''}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-200 focus-within:opacity-100 group-hover:opacity-100">
        <Link
          to={`/sessions/${session.id}/edit`}
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
        <p role="alert" className="mt-2 text-xs text-danger">
          Delete failed: {del.error.message}
        </p>
      )}
    </li>
  )
}

export function SessionsPage() {
  const { data: sessions, isLoading, error } = useSessions()

  return (
    <section>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="mt-1 text-sm text-ink-dim">Every workout, one unified load.</p>
        </div>
        <Link to="/sessions/new">
          <Button>Log session</Button>
        </Link>
      </header>

      {error && <Alert kind="error">Could not load sessions: {error.message}</Alert>}

      {isLoading && (
        <ul className="space-y-2" aria-label="Loading sessions">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-[70px] animate-pulse rounded-xl border border-line bg-panel" />
          ))}
        </ul>
      )}

      {sessions && sessions.length === 0 && (
        <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
          <p className="font-display text-4xl font-bold text-ink-faint">0</p>
          <h2 className="mt-3 font-display text-lg font-semibold">No sessions yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-dim">
            Log your first workout — strength, run, or swim — and Momentum starts tracking your
            load and gains.
          </p>
          <Link to="/sessions/new" className="mt-6 inline-block">
            <Button>Log your first session</Button>
          </Link>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}
    </section>
  )
}
