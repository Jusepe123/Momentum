const MS_PER_DAY = 86_400_000

/**
 * Monday of the week containing the given local calendar date (YYYY-MM-DD).
 * Same UTC-epoch-day arithmetic as the web selectors: 1970-01-01 was a
 * Thursday, so ((epochDay % 7) + 3) % 7 gives Monday = 0.
 */
export function weekStartISO(isoDate: string): string {
  const ms = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(ms)) throw new RangeError(`Invalid ISO date: ${isoDate}`)
  const epochDay = ms / MS_PER_DAY
  const monday = epochDay - ((epochDay % 7) + 3) % 7
  return new Date(monday * MS_PER_DAY).toISOString().slice(0, 10)
}
