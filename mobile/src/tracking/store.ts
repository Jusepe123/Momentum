import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  advance,
  initialDistanceState,
  resetAnchor,
  type DistanceState,
  type GeoPoint,
} from '../lib/geo/distance'
import type { Segment } from '../lib/geo/elapsed'
import { uuid4 } from '../lib/uuid'

export type RunStatus = 'idle' | 'recording' | 'paused' | 'finished'

/** What survives process death. Everything else is derivable or ephemeral. */
interface Snapshot {
  status: RunStatus
  segments: Segment[]
  distance: DistanceState
  /** Local calendar date captured at run START — never recomputed at upload,
   *  or a retried upload the next morning would shift the ACWR day bucket. */
  dateLocal: string | null
  /** Assigned once at finish; becomes the sessions.id on upload so retries
   *  are idempotent. Lives in the snapshot (not component state) so a
   *  process death between finish and upload can't mint a second identity. */
  uploadId: string | null
}

const SNAPSHOT_KEY = 'run_snapshot'

const idleSnapshot: Snapshot = {
  status: 'idle',
  segments: [],
  distance: initialDistanceState,
  dateLocal: null,
  uploadId: null,
}

interface RunStore extends Snapshot {
  start: (dateLocal: string, now: number) => void
  pause: (now: number) => void
  resume: (now: number) => void
  finish: (now: number) => void
  /** After upload success or discard: back to idle, snapshot cleared. */
  reset: () => void
  /** Fold a GPS batch; discards silently unless recording. */
  ingest: (points: GeoPoint[]) => void
  /** Restore a live run from the snapshot. Safe to call repeatedly; the
   *  location task calls it too so a headless (killed-app) runtime resumes
   *  accumulating instead of dropping points. */
  ensureHydrated: () => Promise<void>
}

// Snapshot writes are serialized on one chain so they can never land
// out of call order (e.g. a slow 'recording' write overwriting 'finished').
let writeChain: Promise<void> = Promise.resolve()

function persist(state: Snapshot) {
  const snap: Snapshot = {
    status: state.status,
    segments: state.segments,
    distance: state.distance,
    dateLocal: state.dateLocal,
    uploadId: state.uploadId,
  }
  const payload = JSON.stringify(snap)
  writeChain = writeChain.then(
    () =>
      AsyncStorage.setItem(SNAPSHOT_KEY, payload).catch(() => {
        // A missed snapshot only widens the resurrection gap by one batch.
      }),
  )
}

/** Await this after start/finish so a kill right after the tap can't
 *  resurrect the run in its pre-transition state. */
export function flushSnapshot(): Promise<void> {
  return writeChain
}

let hydration: Promise<void> | null = null

export const useRunStore = create<RunStore>()((set, get) => ({
  ...idleSnapshot,

  start: (dateLocal, now) => {
    const next: Snapshot = {
      status: 'recording',
      segments: [{ startedAt: now, endedAt: null }],
      distance: initialDistanceState,
      dateLocal,
      uploadId: null,
    }
    set(next)
    persist(next)
  },

  pause: (now) => {
    const { status, segments } = get()
    if (status !== 'recording') return
    const closed = segments.map((s) => (s.endedAt === null ? { ...s, endedAt: now } : s))
    set({ status: 'paused', segments: closed })
    persist(get())
  },

  resume: (now) => {
    const { status, segments, distance } = get()
    if (status !== 'paused') return
    set({
      status: 'recording',
      segments: [...segments, { startedAt: now, endedAt: null }],
      // Movement during the pause must never count.
      distance: resetAnchor(distance),
    })
    persist(get())
  },

  finish: (now) => {
    const { status, segments } = get()
    if (status !== 'recording' && status !== 'paused') return
    const closed = segments.map((s) => (s.endedAt === null ? { ...s, endedAt: now } : s))
    set({ status: 'finished', segments: closed, uploadId: uuid4() })
    persist(get())
  },

  reset: () => {
    set(idleSnapshot)
    writeChain = writeChain.then(() => AsyncStorage.removeItem(SNAPSHOT_KEY).catch(() => {}))
  },

  ingest: (points) => {
    if (get().status !== 'recording') return
    const distance = points.reduce((d, p) => advance(d, p), get().distance)
    set({ distance })
    persist(get())
  },

  ensureHydrated: () => {
    if (!hydration) {
      hydration = (async () => {
        try {
          const raw = await AsyncStorage.getItem(SNAPSHOT_KEY)
          if (!raw) return
          const snap = JSON.parse(raw) as Snapshot
          // Only adopt a snapshot that represents an in-flight or unfinished
          // run; a stale idle snapshot has nothing to restore.
          if (snap.status && snap.status !== 'idle') {
            // Older snapshots may predate uploadId; a finished run must have
            // one stable identity before any upload attempt.
            if (snap.status === 'finished' && !snap.uploadId) {
              snap.uploadId = uuid4()
            }
            useRunStore.setState({ ...idleSnapshot, ...snap })
            persist(useRunStore.getState())
          }
        } catch {
          // Corrupt snapshot: start clean rather than crash a run.
        }
      })()
    }
    return hydration
  },
}))
