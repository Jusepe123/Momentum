/** Display formatting for the run screens. Pure; tested in Node. */

export function formatKm(distanceM: number): string {
  return (distanceM / 1000).toFixed(2)
}

/** mm:ss under an hour, h:mm:ss from there on. */
export function formatElapsed(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/**
 * Average pace as m:ss per km. Returns '—:—' until there is enough signal
 * (≥100 m and ≥30 s) for the number to mean anything.
 */
export function formatPace(ms: number, distanceM: number): string {
  if (distanceM < 100 || ms < 30000) return '—:—'
  const msPerKm = ms / (distanceM / 1000)
  const totalSec = Math.round(msPerKm / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * Average speed in km/h to 1 decimal — the bike metric (higher is better).
 * Returns '—' until there is enough signal (≥100 m and ≥30 s), mirroring the
 * guards in formatPace so an early reading never shows a wild number.
 */
export function formatSpeedKmH(ms: number, distanceM: number): string {
  if (distanceM < 100 || ms < 30000) return '—'
  const kmh = distanceM / 1000 / (ms / 3600000)
  return kmh.toFixed(1)
}
