import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BrandImage } from '../../components/brand'
import { Alert, Button, Select } from '../../components/ui'
import { todayLocalISO } from '../../lib/dates'
import { formatDate, formatMinSec } from '../../lib/format'
import {
  acwr,
  classifyAcwr,
  epochDay,
  projectMetric,
  type AcwrZone,
  type MetricPoint,
} from '../../lib/scoring'
import { useSessions, type SessionWithDetails } from '../sessions/hooks'
import { axisProps, chart } from './chartTheme'
import { ChartTooltip } from './ChartTooltip'
import {
  acwrSeries,
  computePRs,
  dailyLoadSeries,
  paceHistory,
  strengthHistories,
  toLoadPoints,
} from './selectors'

const LOAD_WINDOW_DAYS = 56 // 8 weeks
const PROJECTION_WEEKS = [4, 8, 12] as const

const zoneMeta: Record<AcwrZone, { label: string; color: string; note: string }> = {
  undertraining: {
    label: 'Undertraining',
    color: chart.inkDim,
    note: 'Load is well below your recent average — room to push.',
  },
  sweet_spot: {
    label: 'Sweet spot',
    color: chart.ok,
    note: 'Training load is in the healthy 0.8–1.3 range. Keep it up.',
  },
  caution: {
    label: 'Caution',
    color: chart.accent,
    note: 'Load is climbing fast. Consider an easier day soon.',
  },
  high_risk: {
    label: 'High risk',
    color: chart.danger,
    note: 'Acute load far exceeds your base — injury risk is elevated.',
  },
}

function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split('-').map(Number)
  return `${m}/${d}`
}

function Card({
  title,
  subtitle,
  className = '',
  children,
}: {
  title: string
  subtitle?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 ${className}`}>
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-ink-dim">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">
      {children}
    </p>
  )
}

function RiskCard({ sessions, today }: { sessions: SessionWithDetails[]; today: string }) {
  const result = useMemo(() => acwr(toLoadPoints(sessions), today), [sessions, today])
  const zone = result.zone ? zoneMeta[result.zone] : null

  return (
    <section className="rounded-xl border border-line bg-panel p-4">
      <h2 className="font-display text-base font-semibold">Injury risk today</h2>
      <p className="mt-0.5 text-xs text-ink-dim">Acute : chronic workload ratio (ACWR)</p>
      {zone && result.ratio !== null ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span
              aria-hidden
              className="size-4 rounded-full ring-4 ring-inset"
              style={{ backgroundColor: zone.color, ['--tw-ring-color' as string]: `${zone.color}33` }}
            />
            <span className="font-display text-3xl font-bold tracking-tight">
              {result.ratio.toFixed(2)}
            </span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-dim">
              {zone.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-ink-dim">{zone.note}</p>
          <p className="mt-2 text-xs text-ink-faint">
            Acute (7d): {Math.round(result.acute).toLocaleString('en-US')} · Chronic (weekly avg,
            28d): {Math.round(result.chronic).toLocaleString('en-US')}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">
          Not enough training history yet — the ratio appears once you've logged sessions across a
          few weeks.
        </p>
      )}
    </section>
  )
}

function LoadTrendCard({ sessions, today }: { sessions: SessionWithDetails[]; today: string }) {
  const loads = useMemo(
    () => dailyLoadSeries(sessions, today, LOAD_WINDOW_DAYS),
    [sessions, today],
  )
  const ratios = useMemo(
    () =>
      acwrSeries(sessions, today, LOAD_WINDOW_DAYS).map((r) => ({
        ...r,
        tooltipLabel: formatDate(r.date),
      })),
    [sessions, today],
  )
  const hasAny = loads.some((d) => d.load > 0)
  const lastRatio = ratios[ratios.length - 1]?.ratio

  if (!hasAny) {
    return (
      <Card title="Training load" subtitle={`Last ${LOAD_WINDOW_DAYS / 7} weeks`}>
        <EmptyHint>Your daily load and injury-risk trend appear here after your first session.</EmptyHint>
      </Card>
    )
  }

  return (
    <Card title="Training load" subtitle={`Daily session load, last ${LOAD_WINDOW_DAYS / 7} weeks`}>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={loads.map((d) => ({ ...d, tooltipLabel: formatDate(d.date) }))}>
            <CartesianGrid vertical={false} stroke={chart.line} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={32} />
            <YAxis {...axisProps} width={36} />
            <Tooltip
              cursor={{ fill: '#1a1a180d' }}
              content={<ChartTooltip formatter={(v) => `${Math.round(v)} load`} />}
            />
            <Bar dataKey="load" fill={chart.accent} radius={[3, 3, 0, 0]} maxBarSize={8} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <h3 className="mb-1 mt-4 text-xs font-medium uppercase tracking-wide text-ink-dim">
        ACWR ratio
        {typeof lastRatio === 'number' && (
          <span className="ml-2 normal-case tracking-normal text-ink-faint">
            today {lastRatio.toFixed(2)}
          </span>
        )}
      </h3>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={ratios}>
            <CartesianGrid vertical={false} stroke={chart.line} />
            <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={32} />
            <YAxis {...axisProps} width={36} domain={[0, 2]} ticks={[0, 0.8, 1.3, 2]} />
            <ReferenceArea y1={0.8} y2={1.3} fill={chart.ok} fillOpacity={0.08} />
            <Tooltip
              cursor={{ stroke: chart.inkFaint, strokeDasharray: '3 3' }}
              content={
                <ChartTooltip
                  formatter={(v, row) => {
                    const zone = classifyAcwr(v)
                    return `${v.toFixed(2)} — ${zoneMeta[zone].label}${row ? '' : ''}`
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="ratio"
              stroke={chart.ink}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Shaded band = healthy 0.8–1.3 zone. Above 1.5 means acute load far exceeds your base.
      </p>
    </Card>
  )
}

interface ProjectedSeries {
  actual: { x: number; y: number; tooltipLabel: string }[]
  projected: { x: number; y: number; tooltipLabel: string }[]
  projectionNote: string | null
}

function buildProjection(points: MetricPoint[], unitFormat: (v: number) => string): ProjectedSeries {
  const actual = points.map((p) => ({
    x: epochDay(p.date),
    y: p.value,
    tooltipLabel: formatDate(p.date),
  }))
  const last = points[points.length - 1]
  const projected: ProjectedSeries['projected'] = []
  let projectionNote: string | null = null

  const twelveWeeks = projectMetric(points, PROJECTION_WEEKS[2] * 7)
  if (last && twelveWeeks) {
    projected.push(actual[actual.length - 1])
    for (const weeks of PROJECTION_WEEKS) {
      const p = projectMetric(points, weeks * 7)
      if (p) {
        projected.push({
          x: epochDay(last.date) + weeks * 7,
          y: p.value,
          tooltipLabel: `+${weeks} weeks (projected)`,
        })
      }
    }
    projectionNote = `At this trend: ${unitFormat(twelveWeeks.value)} in 12 weeks.`
  }
  return { actual, projected, projectionNote }
}

function ProgressChart({
  points,
  unitFormat,
  yLabel,
}: {
  points: MetricPoint[]
  unitFormat: (v: number) => string
  yLabel: string
}) {
  const { actual, projected, projectionNote } = useMemo(
    () => buildProjection(points, unitFormat),
    [points, unitFormat],
  )

  const domain = useMemo(() => {
    const xs = [...actual, ...projected].map((p) => p.x)
    return [Math.min(...xs), Math.max(...xs)]
  }, [actual, projected])

  return (
    <>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid vertical={false} stroke={chart.line} />
            <XAxis
              dataKey="x"
              type="number"
              domain={domain}
              {...axisProps}
              tickFormatter={(day: number) =>
                shortDate(new Date(day * 86_400_000).toISOString().slice(0, 10))
              }
              minTickGap={40}
            />
            <YAxis
              {...axisProps}
              width={44}
              domain={['auto', 'auto']}
              tickFormatter={(v: number) => unitFormat(v)}
            />
            <Tooltip
              cursor={{ stroke: chart.inkFaint, strokeDasharray: '3 3' }}
              content={<ChartTooltip formatter={(v) => unitFormat(v)} />}
            />
            {projected.length > 0 && (
              <Line
                data={projected}
                dataKey="y"
                type="linear"
                stroke={chart.accent}
                strokeWidth={2}
                strokeOpacity={0.55}
                strokeDasharray="6 5"
                dot={{ r: 3, fill: chart.accent, stroke: chart.surface, strokeWidth: 2 }}
              />
            )}
            <Line
              data={actual}
              dataKey="y"
              type="monotone"
              stroke={chart.accent}
              strokeWidth={2}
              dot={{ r: 3.5, fill: chart.accent, stroke: chart.surface, strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        {projectionNote ??
          `${yLabel}. Projections unlock with 4+ data points across 2+ weeks.`}
      </p>
    </>
  )
}

function StrengthProgressCard({ sessions }: { sessions: SessionWithDetails[] }) {
  const histories = useMemo(() => strengthHistories(sessions), [sessions])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    histories.find((h) => h.exerciseId === selectedId) ??
    histories.reduce<(typeof histories)[number] | null>(
      (best, h) => (best === null || h.points.length > best.points.length ? h : best),
      null,
    )

  return (
    <Card title="Strength progress" subtitle="Best estimated 1RM per day (Epley/Brzycki mean)">
      {histories.length === 0 ? (
        <EmptyHint>Log strength sets to see your estimated 1RM climb.</EmptyHint>
      ) : (
        <>
          <Select
            aria-label="Exercise"
            value={selected!.exerciseId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="mb-3"
          >
            {histories.map((h) => (
              <option key={h.exerciseId} value={h.exerciseId}>
                {h.name}
              </option>
            ))}
          </Select>
          <ProgressChart
            points={selected!.points}
            unitFormat={(v) => `${v.toFixed(1)} kg`}
            yLabel="Estimated 1RM"
          />
        </>
      )}
    </Card>
  )
}

function PaceCard({ sessions }: { sessions: SessionWithDetails[] }) {
  const [sport, setSport] = useState<'run' | 'swim'>('run')
  const points = useMemo(() => paceHistory(sessions, sport), [sessions, sport])
  const unit = sport === 'run' ? '/km' : '/100m'

  return (
    <Card title="Pace progress" subtitle="Best pace per day — lower is better">
      <div role="tablist" className="mb-3 grid w-48 grid-cols-2 gap-1 rounded-lg bg-panel-2 p-1">
        {(['run', 'swim'] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={sport === s}
            onClick={() => setSport(s)}
            className={`h-8 rounded-md text-xs font-medium capitalize transition-colors duration-200 ${
              sport === s ? 'bg-panel text-ink' : 'text-ink-dim hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {points.length === 0 ? (
        <EmptyHint>Log {sport} sessions with distance to track your pace.</EmptyHint>
      ) : (
        <ProgressChart
          points={points}
          unitFormat={(v) => `${formatMinSec(v)} ${unit}`}
          yLabel="Pace"
        />
      )}
    </Card>
  )
}

function PRGrid({ sessions, today }: { sessions: SessionWithDetails[]; today: string }) {
  const prs = useMemo(() => computePRs(sessions, today), [sessions, today])

  return (
    <Card title="Personal records" subtitle="Your all-time bests — break one and it lights up">
      {prs.length === 0 ? (
        <EmptyHint>Records appear as soon as you log sessions.</EmptyHint>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {prs.map((pr) => (
            <li
              key={pr.label}
              className={`rounded-lg border p-3 ${
                pr.isNew ? 'border-accent/50 bg-accent/5' : 'border-line bg-panel-2'
              }`}
            >
              <p className="flex items-start justify-between gap-1 text-xs text-ink-dim">
                <span className="truncate">{pr.label}</span>
                {pr.isNew && (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-surface">
                    NEW
                  </span>
                )}
              </p>
              <p className="mt-1 font-display text-lg font-bold tracking-tight">{pr.value}</p>
              <p className="mt-0.5 text-[11px] text-ink-faint">{formatDate(pr.date)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function DashboardPage() {
  const { data: sessions, isLoading, error } = useSessions()
  const today = todayLocalISO()

  if (error) return <Alert kind="error">Could not load your data: {error.message}</Alert>

  if (isLoading) {
    return (
      <div className="space-y-4" aria-label="Loading dashboard">
        <div className="h-44 animate-pulse rounded-xl border border-line bg-panel" />
        <div className="h-80 animate-pulse rounded-xl border border-line bg-panel" />
      </div>
    )
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-line px-6 py-20 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Your gains, visualized<span className="text-accent">.</span>
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-dim">
          Log your training and this page turns into your load monitor, progress curves, records —
          and where you're headed next.
        </p>
        <Link to="/sessions/new" className="mt-6 inline-block">
          <Button>Log your first session</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h1 className="sr-only">Dashboard</h1>
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="flex flex-col gap-3">
          <RiskCard sessions={sessions} today={today} />
          {/* Optional artwork: drop public/brand/dashboard-hero.png and reload. */}
          <BrandImage
            src="/brand/dashboard-hero.png"
            alt=""
            className="min-h-0 w-full flex-1 rounded-xl border border-line object-cover"
          />
        </div>
        <div className="lg:col-span-2">
          <LoadTrendCard sessions={sessions} today={today} />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <StrengthProgressCard sessions={sessions} />
        <PaceCard sessions={sessions} />
      </div>
      <PRGrid sessions={sessions} today={today} />
      <p className="text-center text-xs text-ink-faint">
        Full data behind these charts lives in{' '}
        <Link to="/sessions" className="text-ink-dim underline hover:text-ink">
          Sessions
        </Link>
        .
      </p>
    </div>
  )
}
