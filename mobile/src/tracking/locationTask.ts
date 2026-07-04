import * as TaskManager from 'expo-task-manager'
import type { LocationObject } from 'expo-location'
import { useRunStore } from './store'
import type { GeoPoint } from '../lib/geo/distance'

/**
 * Background location task. MUST be defined at module scope and imported from
 * index.ts before the app registers, so a headless (killed-app) runtime also
 * defines it — that's what lets a run survive the OS killing the process.
 */
export const LOCATION_TASK = 'momentum-run-location'

interface LocationTaskData {
  locations?: LocationObject[]
}

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[locationTask]', error.message)
    return
  }
  const locations = (data as LocationTaskData | undefined)?.locations ?? []
  if (locations.length === 0) return

  // In a fresh headless runtime the store boots idle; hydrate first so the
  // batch folds into the resurrected run instead of being discarded.
  await useRunStore.getState().ensureHydrated()

  const points: GeoPoint[] = locations.map((l) => ({
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy ?? null,
    timestamp: l.timestamp,
  }))
  useRunStore.getState().ingest(points)
})
