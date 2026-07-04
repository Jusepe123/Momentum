/**
 * Today's date as YYYY-MM-DD in the user's LOCAL timezone.
 * Copied from web src/lib/dates.ts — keep identical.
 * Never use toISOString() for this: it converts to UTC, which shifts the
 * calendar day near midnight and breaks the ACWR day buckets.
 */
export function todayLocalISO(now: Date = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
