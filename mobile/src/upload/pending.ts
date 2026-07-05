import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Finished-but-not-uploaded runs. A run is appended BEFORE its first upload
 * attempt, so a crash or dead network can never lose it; upload success
 * removes it. The Retry path re-reads this list — that's the whole sync engine.
 */
export interface PendingRun {
  id: string
  /** which cardio discipline this session records (drives sessions.sport) */
  sport: 'run' | 'bike'
  /** local calendar date captured at run START (ACWR bucket invariant) */
  dateLocal: string
  activeMs: number
  distanceM: number
  rpe: number
  notes: string
}

const KEY = 'pending_runs'
const CAP = 10

export async function listPending(): Promise<PendingRun[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Runs queued before the bike release predate `sport`; default them to run.
    return (parsed as PendingRun[]).map((r) => ({ ...r, sport: r.sport ?? 'run' }))
  } catch {
    return []
  }
}

export async function addPending(run: PendingRun): Promise<void> {
  const list = await listPending()
  const next = [...list.filter((r) => r.id !== run.id), run]
  if (next.length > CAP) {
    // Never silently drop a recorded run — the caller surfaces this and the
    // run stays alive in the store snapshot until it's uploaded or discarded.
    throw new Error(
      `${CAP} runs are already waiting to upload — sync them from the start screen first.`,
    )
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(next))
}

export async function removePending(id: string): Promise<void> {
  const list = await listPending()
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((r) => r.id !== id)))
}
