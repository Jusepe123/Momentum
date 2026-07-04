import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Finished-but-not-uploaded runs. A run is appended BEFORE its first upload
 * attempt, so a crash or dead network can never lose it; upload success
 * removes it. The Retry path re-reads this list — that's the whole sync engine.
 */
export interface PendingRun {
  id: string
  /** local calendar date captured at run START (ACWR bucket invariant) */
  dateLocal: string
  activeMs: number
  distanceM: number
  rpe: number
  notes: string
}

const KEY = 'pending_runs'
const CAP = 10

export function newPendingId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export async function listPending(): Promise<PendingRun[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as PendingRun[]) : []
  } catch {
    return []
  }
}

export async function addPending(run: PendingRun): Promise<void> {
  const list = await listPending()
  const next = [...list.filter((r) => r.id !== run.id), run]
  // Cap the queue; oldest first out. Ten unsynced runs means something else
  // is wrong anyway.
  await AsyncStorage.setItem(KEY, JSON.stringify(next.slice(-CAP)))
}

export async function removePending(id: string): Promise<void> {
  const list = await listPending()
  await AsyncStorage.setItem(KEY, JSON.stringify(list.filter((r) => r.id !== id)))
}
