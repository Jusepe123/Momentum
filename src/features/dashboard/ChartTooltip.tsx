export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: { value: number | string; name?: string; payload?: Record<string, unknown> }[]
  label?: string | number
  formatter: (value: number, row?: Record<string, unknown>) => string
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]
  const heading =
    (row.payload && typeof row.payload.tooltipLabel === 'string' && row.payload.tooltipLabel) ||
    String(label ?? '')
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2 text-xs shadow-md shadow-ink/5">
      <p className="text-ink-dim">{heading}</p>
      <p className="mt-0.5 font-display text-sm font-semibold text-ink">
        {formatter(Number(row.value), row.payload)}
      </p>
    </div>
  )
}
