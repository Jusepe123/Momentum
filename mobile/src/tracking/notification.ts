import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { formatElapsed, formatKm, formatPace } from '../lib/format'
import { colors } from '../theme'

/**
 * Live run-progress notification (km · time · pace), updated from the
 * background location task on every GPS batch.
 *
 * Why a second notification instead of updating the foreground-service one:
 * expo-location's native consumer only applies new foregroundService options
 * while the app is foregrounded (AppForegroundedSingleton guard) — useless
 * with the screen off — and re-calling startLocationUpdatesAsync also
 * restarts the underlying location request mid-run. Posting our own silent,
 * sticky notification works from headless/background JS.
 */

const CHANNEL_ID = 'run-progress'
const NOTIFICATION_ID = 'run-progress'

let channelReady = false

async function ensureChannel() {
  if (channelReady || Platform.OS !== 'android') return
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Run progress',
    importance: Notifications.AndroidImportance.LOW, // shade only — no sound, no heads-up
    vibrationPattern: [0],
    enableVibrate: false,
    showBadge: false,
  })
  channelReady = true
}

export async function updateRunNotification(
  state: 'recording' | 'paused',
  distanceM: number,
  elapsedMs: number,
) {
  try {
    await ensureChannel()
    const pace = formatPace(elapsedMs, distanceM)
    const stats = `${formatKm(distanceM)} km · ${formatElapsed(elapsedMs)}${
      pace === '—:—' ? '' : ` · ${pace} /km`
    }`
    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID, // same id → updates in place
      content: {
        title: state === 'recording' ? 'Recording run' : 'Run paused',
        body: stats,
        sticky: true,
        sound: false,
        color: colors.run,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: { channelId: CHANNEL_ID }, // immediate, on the silent channel
    })
  } catch {
    // A notification failure must never break tracking.
  }
}

export async function dismissRunNotification() {
  try {
    await Notifications.dismissNotificationAsync(NOTIFICATION_ID)
  } catch {
    // ignore
  }
}
