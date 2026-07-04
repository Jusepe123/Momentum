import * as Location from 'expo-location'
import { Alert, PermissionsAndroid, Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LOCATION_TASK } from './locationTask'
import { useRunStore } from './store'
import { todayLocalISO } from '../lib/dates'
import { colors } from '../theme'

export type StartResult = { ok: true } | { ok: false; message: string }

const BATTERY_PROMPT_KEY = 'battery_prompt_shown'

/**
 * Full start flow, called from the Start button press (app is guaranteed
 * foregrounded — starting a foreground service from the background is the
 * classic Android 12+ failure).
 */
export async function startRun(): Promise<StartResult> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (!fg.granted) {
    return { ok: false, message: 'Momentum needs location access to measure your run.' }
  }

  const bg = await Location.requestBackgroundPermissionsAsync()
  if (!bg.granted) {
    return {
      ok: false,
      message:
        'Choose “Allow all the time” in the location permission so the run keeps recording while the screen is off.',
    }
  }

  if (Platform.OS === 'android' && Platform.Version >= 33) {
    // Non-fatal: without it the FGS notification is hidden, but tracking works.
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => null)
  }

  // Start the store BEFORE the updates so the first GPS batch isn't discarded.
  useRunStore.getState().start(todayLocalISO(), Date.now())

  try {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      timeInterval: 3000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: 'Momentum — recording run',
        notificationBody: 'Distance and time are being measured.',
        notificationColor: colors.run,
        killServiceOnDestroy: false,
      },
    })
  } catch (e) {
    useRunStore.getState().reset()
    return {
      ok: false,
      message: `Could not start GPS tracking. ${e instanceof Error ? e.message : ''}`.trim(),
    }
  }

  void maybeExplainBatterySettings()
  return { ok: true }
}

/** Pause leaves the GPS/foreground service running on purpose — restarting an
 *  FGS from the background is unreliable; the store just discards points. */
export function pauseRun() {
  useRunStore.getState().pause(Date.now())
}

export function resumeRun() {
  useRunStore.getState().resume(Date.now())
}

export async function finishRun() {
  useRunStore.getState().finish(Date.now())
  await stopTracking()
}

export async function stopTracking() {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false)
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {})
  }
}

/**
 * Launch reconciliation: restore a live run from the snapshot, and kill an
 * orphaned location task (task running but nothing to record into).
 */
export async function reconcileOnLaunch() {
  await useRunStore.getState().ensureHydrated()
  const { status } = useRunStore.getState()
  if (status === 'idle' || status === 'finished') {
    await stopTracking()
  }
}

async function maybeExplainBatterySettings() {
  if (Platform.OS !== 'android') return
  try {
    const shown = await AsyncStorage.getItem(BATTERY_PROMPT_KEY)
    if (shown) return
    await AsyncStorage.setItem(BATTERY_PROMPT_KEY, '1')
    Alert.alert(
      'One-time setup',
      'Some phones kill background apps aggressively. In Settings → Apps → Momentum → Battery, choose “Unrestricted” so a run in progress is never killed.',
    )
  } catch {
    // cosmetic only
  }
}
