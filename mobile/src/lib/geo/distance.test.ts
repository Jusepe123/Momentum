import { describe, expect, it } from 'vitest'
import {
  advance,
  BIKE_FILTER,
  DEFAULT_FILTER,
  filterForSport,
  haversineM,
  initialDistanceState,
  resetAnchor,
  RUN_FILTER,
  type DistanceState,
  type FilterConfig,
  type GeoPoint,
} from './distance'

// Along a meridian, metres → degrees is linear: 1 m = 1/(π·R/180) deg with R = 6371000.
// All expected values below computed with node -e (see repo convention), not by hand.
const DEG_PER_M = 0.000008993216059187306

function pt(northM: number, t: number, accuracy = 5, eastM = 0): GeoPoint {
  return {
    latitude: northM * DEG_PER_M,
    longitude: eastM * DEG_PER_M,
    accuracy,
    timestamp: t,
  }
}

function feed(points: GeoPoint[], start: DistanceState = initialDistanceState): DistanceState {
  return points.reduce((s, p) => advance(s, p, DEFAULT_FILTER), start)
}

describe('haversineM', () => {
  it('measures a 10 m meridian step as 10 m', () => {
    // node -e: haversine((0,0) → (10·DEG_PER_M, 0)) = 10
    expect(haversineM(pt(0, 0), pt(10, 1))).toBeCloseTo(10, 6)
  })
})

describe('advance', () => {
  it('anchors on the first fix and adds nothing', () => {
    const s = feed([pt(0, 0)])
    expect(s.totalM).toBe(0)
    expect(s.anchor).not.toBeNull()
  })

  it('ignores fixes with accuracy worse than the gate, even as first fix', () => {
    const s = feed([pt(0, 0, 26)])
    expect(s).toEqual(initialDistanceState)
  })

  it('stationary jitter accumulates zero (all displacement below the 5 m gate)', () => {
    // 20 fixes wobbling ≤3 m around the anchor, 3 s apart
    const jitter = [pt(0, 0)]
    for (let i = 1; i <= 20; i++) {
      jitter.push(pt(i % 2 === 0 ? 3 : -2, i * 3000, 8, i % 3 === 0 ? 2 : 0))
    }
    expect(feed(jitter).totalM).toBe(0)
  })

  it('measures a straight-line run within 1%', () => {
    // 100 points, 10 m apart, 5 s apart → 99 steps × 10 m = 990 m (node -e)
    const line = Array.from({ length: 100 }, (_, i) => pt(i * 10, i * 5000))
    const total = feed(line).totalM
    expect(total).toBeGreaterThan(990 * 0.99)
    expect(total).toBeLessThan(990 * 1.01)
  })

  it('slow movement below the gate still accumulates once past it', () => {
    // 2 m steps every 3 s: displacement from anchor hits 6 m every 3rd fix
    // → adds 6 m per cycle, 9 steps = 18 m (node -e: haversine(6 m) = 6)
    const slow = Array.from({ length: 10 }, (_, i) => pt(i * 2, i * 3000))
    expect(feed(slow).totalM).toBeCloseTo(18, 6)
  })

  it('re-anchors on a teleport without adding distance', () => {
    // 500 m in 5 s = 100 m/s > 12.5 m/s gate
    const s1 = feed([pt(0, 0), pt(500, 5000)])
    expect(s1.totalM).toBe(0)
    // ...and keeps measuring from the new anchor
    const s2 = advance(s1, pt(510, 10000), DEFAULT_FILTER)
    expect(s2.totalM).toBeCloseTo(10, 6)
  })

  it('treats a non-advancing timestamp as a teleport (no divide-by-zero)', () => {
    const s = feed([pt(0, 0), pt(10, 0)])
    expect(s.totalM).toBe(0)
    expect(s.anchor?.latitude).toBeCloseTo(10 * DEG_PER_M, 12)
  })

  it('keeps exact-boundary values on the accepting side of each gate', () => {
    // accuracy === 25 is accepted (rule is >25 drops)
    expect(feed([pt(0, 0, 25), pt(10, 5000, 25)]).totalM).toBeCloseTo(10, 6)
    // displacement === 5 m accumulates (rule is <5 keeps the old anchor)
    expect(feed([pt(0, 0), pt(5, 3000)]).totalM).toBeCloseTo(5, 6)
    // speed === 12.5 m/s accumulates (rule is >12.5 teleports): 5 m in 0.4 s
    expect(feed([pt(0, 0), pt(5, 400)]).totalM).toBeCloseTo(5, 6)
  })

  it('is immune to interleaved bad-accuracy garbage', () => {
    const clean = Array.from({ length: 50 }, (_, i) => pt(i * 10, i * 5000))
    const dirty: GeoPoint[] = []
    clean.forEach((p, i) => {
      dirty.push(p)
      // wildly wrong fix 300 m east, flagged inaccurate
      if (i % 4 === 2) dirty.push(pt(i * 10, p.timestamp + 1000, 80, 300))
    })
    expect(feed(dirty).totalM).toBeCloseTo(feed(clean).totalM, 6)
  })
})

function feedWith(cfg: FilterConfig, points: GeoPoint[]): DistanceState {
  return points.reduce((s, p) => advance(s, p, cfg), initialDistanceState)
}

describe('sport filters (run vs bike teleport gate)', () => {
  it('DEFAULT_FILTER is the run filter', () => {
    expect(DEFAULT_FILTER).toBe(RUN_FILTER)
  })

  it('filterForSport maps sport → config', () => {
    expect(filterForSport('run')).toBe(RUN_FILTER)
    expect(filterForSport('bike')).toBe(BIKE_FILTER)
  })

  it('accepts a ~20 m/s fix on the bike but re-anchors it on the run', () => {
    // 60 m in 3 s = 20 m/s: above the 12.5 m/s run gate, below the 25 m/s bike
    // gate (node -e: haversine(60 m) = 60).
    const points = [pt(0, 0), pt(60, 3000)]
    expect(feedWith(BIKE_FILTER, points).totalM).toBeCloseTo(60, 6) // accepted
    expect(feedWith(RUN_FILTER, points).totalM).toBe(0) // teleport → adds 0
  })

  it('bike keeps measuring from the new anchor after a fast fix run would drop', () => {
    // Same fast fix, then a slow legit step. On the bike both add; on the run
    // the first re-anchors (0) and only the second-relative step could count.
    const s1Bike = feedWith(BIKE_FILTER, [pt(0, 0), pt(60, 3000)])
    const s2Bike = advance(s1Bike, pt(70, 6000), BIKE_FILTER)
    expect(s2Bike.totalM).toBeCloseTo(70, 6) // 60 + 10

    const s1Run = feedWith(RUN_FILTER, [pt(0, 0), pt(60, 3000)])
    const s2Run = advance(s1Run, pt(70, 6000), RUN_FILTER)
    expect(s2Run.totalM).toBeCloseTo(10, 6) // re-anchored at 60, then +10
  })

  it('speed exactly at the bike cap accumulates (rule is >cap teleports)', () => {
    // 50 m in 2 s = 25 m/s == BIKE_FILTER cap (node -e: haversine(50 m) = 50)
    expect(feedWith(BIKE_FILTER, [pt(0, 0), pt(50, 2000)]).totalM).toBeCloseTo(50, 6)
    // ...and the same fix is a teleport on the run (25 > 12.5)
    expect(feedWith(RUN_FILTER, [pt(0, 0), pt(50, 2000)]).totalM).toBe(0)
  })
})

describe('resetAnchor', () => {
  it('keeps the total but forgets the anchor, so post-pause movement adds nothing', () => {
    const during = feed([pt(0, 0), pt(10, 5000)])
    expect(during.totalM).toBeCloseTo(10, 6)
    // user pauses, walks 200 m away, resumes
    const resumed = advance(resetAnchor(during), pt(210, 300000), DEFAULT_FILTER)
    expect(resumed.totalM).toBeCloseTo(10, 6) // first fix after resume only re-anchors
    const next = advance(resumed, pt(220, 305000), DEFAULT_FILTER)
    expect(next.totalM).toBeCloseTo(20, 6) // then normal accumulation continues
  })
})
