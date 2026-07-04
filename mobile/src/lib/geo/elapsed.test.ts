import { describe, expect, it } from 'vitest'
import { activeElapsedMs, type Segment } from './elapsed'

describe('activeElapsedMs', () => {
  it('is 0 with no segments', () => {
    expect(activeElapsedMs([], 1000)).toBe(0)
  })

  it('counts an open segment up to now', () => {
    const segs: Segment[] = [{ startedAt: 1000, endedAt: null }]
    expect(activeElapsedMs(segs, 61000)).toBe(60000)
  })

  it('counts a closed segment by its own bounds, ignoring now', () => {
    const segs: Segment[] = [{ startedAt: 1000, endedAt: 31000 }]
    expect(activeElapsedMs(segs, 999999)).toBe(30000)
  })

  it('sums closed segments plus the open one (pause/resume)', () => {
    const segs: Segment[] = [
      { startedAt: 0, endedAt: 60000 }, // 1 min, then paused
      { startedAt: 120000, endedAt: 300000 }, // 3 min, then paused
      { startedAt: 360000, endedAt: null }, // running again
    ]
    // 60000 + 180000 + (400000 - 360000) = 280000
    expect(activeElapsedMs(segs, 400000)).toBe(280000)
  })

  it('never goes negative on clock weirdness', () => {
    expect(activeElapsedMs([{ startedAt: 5000, endedAt: null }], 3000)).toBe(0)
    expect(activeElapsedMs([{ startedAt: 5000, endedAt: 1000 }], 999999)).toBe(0)
  })
})
