import { Link } from 'react-router-dom'
import { Alert, Button } from '../../components/ui'
import { sportBgClass, sportColorClass } from '../../components/sportColors'
import { SportIcon } from '../../components/sportIcons'
import { paceSecPerKm, speedKmH, volumeLoad } from '../../lib/scoring'
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
  const metric =
    s.sport === 'run'
      ? `${formatMinSec(paceSecPerKm(durationSec, dist))} /km`
      : `${speedKmH(durationSec, dist).toFixed(1)} km/h`
  return `${formatDistance(dist)} · ${metric}`
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
    <li className="px-4 transition-colors duration-200 hover:bg-panel-2/50">
      <div className="group flex items-center gap-3 py-2.5">
        <span
          className={`flex size-10 shrink-0 items-center justify-center rounded-full ${sportBgClass[session.sport]} ${sportColorClass[session.sport]}`}
        >
          <SportIcon sport={session.sport} title={meta.label} className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">
            <span className="font-medium">{formatDate(session.date)}</span>
            <span className="text-ink-dim"> · {meta.label}</span>
            {stat && <span className="text-ink-dim"> · {stat}</span>}
          </p>
          <p className="truncate text-xs text-ink-faint">
            {session.duration_min} min · effort {session.rpe}
            {session.notes ? ` · ${session.notes}` : ''}
          </p>
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
        <div className="w-14 shrink-0 text-right">
          <p className="font-display text-sm font-bold text-ink">
            {session.unified_load !== null ? Math.round(session.unified_load) : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-ink-faint">load</p>
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

export function SessionsPage() {
  const { data: sessions, isLoading, error } = useSessions()

  return (
    <section>
      <header className="mb-5 flex items-center justify-between">
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
        <ul
          className="divide-y divide-line rounded-xl border border-line bg-panel"
          aria-label="Loading sessions"
        >
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="h-[61px] animate-pulse" />
          ))}
        </ul>
      )}

      {sessions && sessions.length === 0 && (
        <div className="rounded-xl border border-dashed border-line bg-panel px-6 py-16 text-center">
          <p className="font-display text-4xl font-bold text-ink-faint">0</p>
          <h2 className="mt-3 font-display text-lg font-semibold">No sessions yet</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-ink-dim">
            Log your first workout — strength, run, or bike — and Momentum starts tracking your
            load and gains.
          </p>
          <Link to="/sessions/new" className="mt-6 inline-block">
            <Button>Log your first session</Button>
          </Link>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </ul>
      )}
    </section>
  )
}
