import { useEffect, useState } from 'react'
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRunStore } from '../../tracking/store'
import {
  finishRun,
  pauseRun,
  refreshRunNotification,
  resumeRun,
  startRecording,
} from '../../tracking/recorder'
import { activeElapsedMs } from '../../lib/geo/elapsed'
import { formatElapsed, formatKm, formatPace, formatSpeedKmH } from '../../lib/format'
import { Button, ErrorText } from '../../components/ui'
import { SportIcon } from '../../components/SportIcon'
import { colors, fonts, sportColor } from '../../theme'

type RecorderSport = 'run' | 'bike'

const SPORT_LABEL: Record<RecorderSport, string> = { run: 'Run', bike: 'Ride' }

/**
 * Sport-aware GPS recorder (run or bike). The Start/Pause/Resume/Finish state
 * machine is identical across sports; only the identity hue, copy and the
 * third stat (pace /km for run, speed km/h for bike) change. `onBack` returns
 * to Home and is only offered while idle — you can't leave a live recording.
 */
export function RecorderScreen({
  sport,
  onBack,
}: {
  sport: RecorderSport
  onBack?: () => void
}) {
  const status = useRunStore((s) => s.status)
  const segments = useRunStore((s) => s.segments)
  const distanceM = useRunStore((s) => s.distance.totalM)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [, forceTick] = useState(0)

  // Re-render twice a second while recording; elapsed time is recomputed from
  // segment timestamps, so nothing drifts and nothing accumulates here.
  //
  // The OS pauses JS timers while the screen is off, so on wake the clock would
  // stay frozen at the last tick until the next interval fires. Snap it forward
  // the instant the app returns to the foreground — and re-post the shade
  // notification (otherwise only refreshed on GPS batches) so both are current.
  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => forceTick((t) => t + 1), 500)
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        forceTick((t) => t + 1)
        refreshRunNotification()
      }
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [status])

  const elapsedMs = activeElapsedMs(segments, Date.now())
  const hue = sportColor[sport]
  const isIdle = status === 'idle'

  async function handleStart() {
    setError(null)
    setStarting(true)
    const result = await startRecording(sport)
    setStarting(false)
    if (!result.ok) setError(result.message)
  }

  async function handleFinish() {
    setFinishing(true)
    try {
      await finishRun() // status flips to 'finished'; App swaps to the summary
    } finally {
      setFinishing(false)
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {isIdle && onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to home"
            onPress={onBack}
            hitSlop={12}
            style={styles.backBtn}
          >
            <Text style={styles.backChevron}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.backBtn} />
        )}

        <View style={[styles.sportBadge, { borderColor: hue }]}>
          <SportIcon sport={sport} color={hue} size={18} />
          <Text style={[styles.sportBadgeText, { color: hue }]}>{SPORT_LABEL[sport]}</Text>
        </View>

        {status !== 'idle' ? (
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === 'recording' ? hue : colors.inkFaint },
              ]}
            />
            <Text style={styles.statusText}>
              {status === 'recording' ? 'Recording' : 'Paused'}
            </Text>
          </View>
        ) : (
          <View style={styles.backBtn} />
        )}
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroValue}>{formatKm(distanceM)}</Text>
        <Text style={styles.heroLabel}>kilometres</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatElapsed(elapsedMs)}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            {sport === 'bike' ? (
              <>
                <Text style={styles.statValue}>{formatSpeedKmH(elapsedMs, distanceM)}</Text>
                <Text style={styles.statLabel}>km/h</Text>
              </>
            ) : (
              <>
                <Text style={styles.statValue}>{formatPace(elapsedMs, distanceM)}</Text>
                <Text style={styles.statLabel}>pace /km</Text>
              </>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {error && <ErrorText>{error}</ErrorText>}
        {status === 'idle' && (
          <Button title={`Start ${SPORT_LABEL[sport].toLowerCase()}`} onPress={handleStart} busy={starting} />
        )}
        {status === 'recording' && (
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <Button title="Pause" variant="ghost" onPress={pauseRun} disabled={finishing} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Finish" onPress={() => void handleFinish()} busy={finishing} />
            </View>
          </View>
        )}
        {status === 'paused' && (
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <Button title="Resume" onPress={resumeRun} disabled={finishing} />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Finish"
                variant="ghost"
                onPress={() => void handleFinish()}
                busy={finishing}
              />
            </View>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: 64,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backChevron: {
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 34,
    color: colors.ink,
  },
  sportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  sportBadgeText: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontFamily: fonts.textSemi,
    fontSize: 12,
    color: colors.ink,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroValue: {
    fontFamily: fonts.display,
    fontSize: 88,
    color: colors.ink,
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: colors.inkDim,
    marginTop: -4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 40,
  },
  stat: {
    alignItems: 'center',
    minWidth: 110,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.line,
  },
  statValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 32,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginTop: 2,
  },
  actions: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
})
