import { describe, expect, it } from 'vitest'
import { acwr, classifyAcwr } from './acwr'

// Helper: uniform load of `load` on every day from start to end inclusive.
function daily(start: string, end: string, load: number) {
  const out: { date: string; load: number }[] = []
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = Date.parse(`${end}T00:00:00Z`)
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    out.push({ date: new Date(t).toISOString().slice(0, 10), load })
  }
  return out
}

describe('acwr rolling windows', () => {
  // asOf 2026-03-31: acute window = Mar 25..31 (7 days),
  // chronic window = Mar 04..31 (28 days).

  it('uniform load gives ratio 1.0 (acute week == average week)', () => {
    const sessions = daily('2026-03-04', '2026-03-31', 100)
    const r = acwr(sessions, '2026-03-31')
    expect(r.acute).toBe(700)
    expect(r.chronic).toBe(700) // 2800 / 4
    expect(r.ratio).toBeCloseTo(1.0, 6)
    expect(r.zone).toBe('sweet_spot')
  })

  it('includes the acute boundary day (asOf - 6) and excludes the day before', () => {
    const inWindow = acwr([{ date: '2026-03-25', load: 100 }], '2026-03-31')
    expect(inWindow.acute).toBe(100)
    const outOfWindow = acwr([{ date: '2026-03-24', load: 100 }], '2026-03-31')
    expect(outOfWindow.acute).toBe(0)
  })

  it('includes the chronic boundary day (asOf - 27) and excludes the day before', () => {
    const inWindow = acwr([{ date: '2026-03-04', load: 400 }], '2026-03-31')
    expect(inWindow.chronic).toBe(100) // 400 / 4 weeks
    const outOfWindow = acwr([{ date: '2026-03-03', load: 400 }], '2026-03-31')
    expect(outOfWindow.chronic).toBe(0)
  })

  it('ignores sessions after asOf', () => {
    const r = acwr(
      [
        { date: '2026-03-30', load: 100 },
        { date: '2026-04-01', load: 999 },
      ],
      '2026-03-31',
    )
    expect(r.acute).toBe(100)
  })

  it('sums multiple sessions on the same day', () => {
    const r = acwr(
      [
        { date: '2026-03-31', load: 100 },
        { date: '2026-03-31', load: 50 },
      ],
      '2026-03-31',
    )
    expect(r.acute).toBe(150)
  })

  it('detects a risky spike: light month then heavy week', () => {
    const sessions = [
      ...daily('2026-03-04', '2026-03-24', 50),
      ...daily('2026-03-25', '2026-03-31', 200),
    ]
    const r = acwr(sessions, '2026-03-31')
    expect(r.acute).toBe(1400)
    // chronic = (21 * 50 + 7 * 200) / 4 = 2450 / 4 = 612.5
    expect(r.chronic).toBeCloseTo(612.5, 6)
    expect(r.ratio).toBeGreaterThan(1.5)
    expect(r.zone).toBe('high_risk')
  })

  it('returns null ratio and zone when there is no chronic load', () => {
    const r = acwr([], '2026-03-31')
    expect(r.acute).toBe(0)
    expect(r.chronic).toBe(0)
    expect(r.ratio).toBeNull()
    expect(r.zone).toBeNull()
  })
})

describe('classifyAcwr zone boundaries', () => {
  it.each([
    [0.79, 'undertraining'],
    [0.8, 'sweet_spot'],
    [1.0, 'sweet_spot'],
    [1.3, 'sweet_spot'],
    [1.31, 'caution'],
    [1.5, 'caution'],
    [1.51, 'high_risk'],
  ] as const)('classifies %f as %s', (ratio, zone) => {
    expect(classifyAcwr(ratio)).toBe(zone)
  })
})
