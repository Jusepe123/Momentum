import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useRunStore } from '../../tracking/store'
import { finishRun, pauseRun, resumeRun, startRun } from '../../tracking/recorder'
import { activeElapsedMs } from '../../lib/geo/elapsed'
import { formatElapsed, formatKm, formatPace } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import { listPending, removePending } from '../../upload/pending'
import { uploadRun } from '../../upload/uploadRun'
import { Button, ErrorText } from '../../components/ui'
import { colors, fonts } from '../../theme'

export function RunScreen() {
  const status = useRunStore((s) => s.status)
  const segments = useRunStore((s) => s.segments)
  const distanceM = useRunStore((s) => s.distance.totalM)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [, forceTick] = useState(0)

  // Runs finished earlier but never uploaded (dead network, crash) wait in
  // the pending queue; surface them whenever the screen is idle.
  useEffect(() => {
    if (status !== 'idle') return
    listPending().then((list) => setPendingCount(list.length))
  }, [status])

  // Re-render twice a second while recording; elapsed time is recomputed from
  // segment timestamps, so nothing drifts and nothing accumulates here.
  useEffect(() => {
    if (status !== 'recording') return
    const id = setInterval(() => forceTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [status])

  const elapsedMs = activeElapsedMs(segments, Date.now())

  async function handleStart() {
    setError(null)
    setStarting(true)
    const result = await startRun()
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

  async function handleSyncPending() {
    setError(null)
    setSyncing(true)
    try {
      for (const run of await listPending()) {
        await uploadRun(run)
        await removePending(run.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed — try again with signal.')
    } finally {
      setPendingCount((await listPending()).length)
      setSyncing(false)
    }
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>
          Momentum<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        {status !== 'idle' && (
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: status === 'recording' ? colors.run : colors.inkFaint },
              ]}
            />
            <Text style={styles.statusText}>
              {status === 'recording' ? 'Recording' : 'Paused'}
            </Text>
          </View>
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
            <Text style={styles.statValue}>{formatPace(elapsedMs, distanceM)}</Text>
            <Text style={styles.statLabel}>pace /km</Text>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        {error && <ErrorText>{error}</ErrorText>}
        {status === 'idle' && (
          <>
            <Button title="Start run" onPress={handleStart} busy={starting} />
            {pendingCount > 0 && (
              <Button
                title={`Upload ${pendingCount} saved run${pendingCount > 1 ? 's' : ''}`}
                variant="ghost"
                onPress={handleSyncPending}
                busy={syncing}
              />
            )}
            <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
          </>
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
  wordmark: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.ink,
    letterSpacing: -0.3,
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
