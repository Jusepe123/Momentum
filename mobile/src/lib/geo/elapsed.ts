/**
 * Active run time as pause-aware segments of epoch timestamps. Pure — the UI
 * ticks a re-render and recomputes; nothing accumulates in a setInterval, so
 * there is no drift and the value survives process death via the snapshot.
 */

export interface Segment {
  /** epoch ms */
  startedAt: number
  /** epoch ms; null while this segment is still running */
  endedAt: number | null
}

export function activeElapsedMs(segments: Segment[], now: number): number {
  return segments.reduce((sum, seg) => {
    const end = seg.endedAt ?? now
    return sum + Math.max(0, end - seg.startedAt)
  }, 0)
}
