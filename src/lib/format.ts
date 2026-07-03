/** 330 -> "5:30". Seconds are rounded to the nearest whole second. */
export function formatMinSec(totalSec: number): string {
  const rounded = Math.round(totalSec)
  const min = Math.floor(rounded / 60)
  const sec = rounded % 60
  return `${min}:${String(sec).padStart(2, '0')}`
}

/** 8000 -> "8 km", 1500 -> "1.5 km", 800 -> "800 m". */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${distanceM} m`
  const km = distanceM / 1000
  return `${Number.isInteger(km) ? km : km.toFixed(2).replace(/\.?0+$/, '')} km`
}

/** "2026-07-03" -> "Jul 3, 2026" (rendered from calendar parts, no TZ math). */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
