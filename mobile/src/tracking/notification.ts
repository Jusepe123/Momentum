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
 *
 * The module is loaded lazily behind try/catch: this file is imported from
 * locationTask.ts, which index.ts imports before anything renders — if
 * expo-notifications ever fails to initialize, the app must still boot and
 * track runs; only the live stats notification goes missing.
 */

type NotificationsModule = typeof import('expo-notifications')

const CHANNEL_ID = 'run-progress'
const NOTIFICATION_ID = 'run-progress'

let notifications: NotificationsModule | null = null
try {
  notifications = require('expo-notifications') as NotificationsModule
  // Show our notification in the shade even while the app is foregrounded.
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  })
} catch (e) {
  console.warn('[notification] expo-notifications unavailable:', e)
  notifications = null
}

let channelReady = false

async function ensureChannel(mod: NotificationsModule) {
  if (channelReady || Platform.OS !== 'android') return
  await mod.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Run progress',
    importance: mod.AndroidImportance.LOW, // shade only — no sound, no heads-up
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
  if (!notifications) return
  try {
    await ensureChannel(notifications)
    const pace = formatPace(elapsedMs, distanceM)
    const stats = `${formatKm(distanceM)} km · ${formatElapsed(elapsedMs)}${
      pace === '—:—' ? '' : ` · ${pace} /km`
    }`
    await notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID, // same id → updates in place
      content: {
        title: state === 'recording' ? 'Recording run' : 'Run paused',
        body: stats,
        sticky: true,
        sound: false,
        color: colors.run,
        priority: notifications.AndroidNotificationPriority.LOW,
      },
      trigger: { channelId: CHANNEL_ID }, // immediate, on the silent channel
    })
  } catch {
    // A notification failure must never break tracking.
  }
}

export async function dismissRunNotification() {
  if (!notifications) return
  try {
    await notifications.dismissNotificationAsync(NOTIFICATION_ID)
  } catch {
    // ignore
  }
}
