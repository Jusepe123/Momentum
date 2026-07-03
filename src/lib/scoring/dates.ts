/**
 * Date helpers for the rolling-window math. Dates are plain calendar days
 * (YYYY-MM-DD strings, as stored in the sessions.date column); converting
 * through UTC epoch days keeps the arithmetic timezone-independent.
 */

const MS_PER_DAY = 86_400_000

/** Days since the Unix epoch for a YYYY-MM-DD calendar date. */
export function epochDay(isoDate: string): number {
  const ms = Date.parse(`${isoDate}T00:00:00Z`)
  if (Number.isNaN(ms)) {
    throw new RangeError(`Invalid ISO date: ${isoDate}`)
  }
  return ms / MS_PER_DAY
}
