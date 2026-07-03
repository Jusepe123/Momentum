import { epochDay } from './dates'

export type AcwrZone = 'undertraining' | 'sweet_spot' | 'caution' | 'high_risk'

export interface SessionLoadPoint {
  /** Calendar date, YYYY-MM-DD. */
  date: string
  /** Unified session-RPE load. */
  load: number
}

export interface AcwrResult {
  /** Sum of load over the 7 days ending at asOf (inclusive). */
  acute: number
  /** Average weekly load over the 28 days ending at asOf (inclusive). */
  chronic: number
  /** acute / chronic, or null when there is no chronic load. */
  ratio: number | null
  zone: AcwrZone | null
}

export function classifyAcwr(ratio: number): AcwrZone {
  if (ratio < 0.8) return 'undertraining'
  if (ratio <= 1.3) return 'sweet_spot'
  if (ratio <= 1.5) return 'caution'
  return 'high_risk'
}

/**
 * Acute:Chronic Workload Ratio at a given date.
 * Both windows END at asOf inclusive: acute spans [asOf-6, asOf] (7 days),
 * chronic spans [asOf-27, asOf] (28 days, expressed as an average week).
 */
export function acwr(sessions: SessionLoadPoint[], asOf: string): AcwrResult {
  const end = epochDay(asOf)
  const acuteStart = end - 6
  const chronicStart = end - 27

  let acute = 0
  let chronicSum = 0
  for (const s of sessions) {
    const day = epochDay(s.date)
    if (day > end || day < chronicStart) continue
    chronicSum += s.load
    if (day >= acuteStart) acute += s.load
  }

  const chronic = chronicSum / 4
  const ratio = chronic > 0 ? acute / chronic : null
  return { acute, chronic, ratio, zone: ratio === null ? null : classifyAcwr(ratio) }
}
