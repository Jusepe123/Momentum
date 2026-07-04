import { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRunStore } from '../../tracking/store'
import { activeElapsedMs } from '../../lib/geo/elapsed'
import { formatElapsed, formatKm, formatPace } from '../../lib/format'
import { addPending, newPendingId, removePending, type PendingRun } from '../../upload/pending'
import { uploadRun } from '../../upload/uploadRun'
import { Button, ErrorText, Input } from '../../components/ui'
import { colors, fonts } from '../../theme'

/** Same four effort levels as the web log form — they persist as rpe. */
const EFFORT_LEVELS = [
  { rpe: 3, label: 'Easy', hint: 'could do lots more' },
  { rpe: 5, label: 'Moderate', hint: 'breathing harder' },
  { rpe: 7, label: 'Hard', hint: 'a few reps in the tank' },
  { rpe: 9, label: 'Max effort', hint: 'nothing left' },
] as const

export function SummaryScreen({ userId: _userId }: { userId: string }) {
  const segments = useRunStore((s) => s.segments)
  const distanceM = useRunStore((s) => s.distance.totalM)
  const dateLocal = useRunStore((s) => s.dateLocal)
  const reset = useRunStore((s) => s.reset)

  const [rpe, setRpe] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // Set once the run has been queued: from then on the button reads Retry and
  // the queue entry (not component state) is the source of truth.
  const [pendingId, setPendingId] = useState<string | null>(null)

  // Segments are all closed after finish, so `now` is irrelevant — but compute
  // once and freeze so the summary can never tick.
  const activeMs = useMemo(() => activeElapsedMs(segments, Date.now()), [segments])
  const noDistance = distanceM < 1

  async function handleUpload() {
    if (rpe === null || dateLocal === null) return
    setError(null)
    setBusy(true)
    const run: PendingRun = {
      id: pendingId ?? newPendingId(),
      dateLocal,
      activeMs,
      distanceM,
      rpe,
      notes,
    }
    try {
      // Queue first: a crash or dead network mid-upload must never lose the run.
      await addPending(run)
      setPendingId(run.id)
      await uploadRun(run)
      await removePending(run.id)
      reset() // back to the idle run screen
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : 'Upload failed.'} The run is saved on this phone — retry when you have signal.`,
      )
    } finally {
      setBusy(false)
    }
  }

  function handleDiscard() {
    Alert.alert('Discard this run?', 'The distance and time will be lost.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          if (pendingId) void removePending(pendingId)
          reset()
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Run complete</Text>
      <Text style={styles.date}>{dateLocal}</Text>

      <View style={styles.statsCard}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{formatKm(distanceM)}</Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{formatElapsed(activeMs)}</Text>
          <Text style={styles.statLabel}>time</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>{formatPace(activeMs, distanceM)}</Text>
          <Text style={styles.statLabel}>pace /km</Text>
        </View>
      </View>

      {noDistance ? (
        <>
          <Text style={styles.noDistance}>
            No distance was recorded, so there is nothing to upload.
          </Text>
          <Button title="Discard run" variant="danger" onPress={handleDiscard} />
        </>
      ) : (
        <>
          <Text style={styles.sectionLabel}>How hard was it?</Text>
          <View style={styles.chips}>
            {EFFORT_LEVELS.map((level) => {
              const selected = rpe === level.rpe
              return (
                <Pressable
                  key={level.rpe}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => setRpe(level.rpe)}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipLabel, selected && styles.chipTextSelected]}>
                    {level.label}
                  </Text>
                  <Text style={[styles.chipHint, selected && styles.chipHintSelected]}>
                    {level.hint}
                  </Text>
                </Pressable>
              )
            })}
          </View>

          <Text style={styles.sectionLabel}>Notes (optional)</Text>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="How did it feel?"
            multiline
            numberOfLines={3}
            style={styles.notes}
          />

          {error && <ErrorText>{error}</ErrorText>}

          <View style={styles.actions}>
            <Button
              title={pendingId && error ? 'Retry upload' : 'Upload run'}
              onPress={handleUpload}
              busy={busy}
              disabled={rpe === null}
            />
            {rpe === null && <Text style={styles.hint}>Pick an effort level to upload.</Text>}
            <Button title="Discard" variant="ghost" onPress={handleDiscard} />
          </View>
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: 24,
    paddingTop: 72,
    gap: 12,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  date: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
    marginBottom: 8,
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 20,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.line,
  },
  statValue: {
    fontFamily: fonts.displayMedium,
    fontSize: 24,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.inkFaint,
    marginTop: 2,
  },
  noDistance: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
    marginVertical: 8,
  },
  sectionLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkDim,
    marginTop: 8,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 14,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.panel,
  },
  chipHint: {
    fontFamily: fonts.text,
    fontSize: 11,
    color: colors.inkFaint,
    marginTop: 1,
  },
  chipHintSelected: {
    color: 'rgba(255,255,255,0.7)',
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
  hint: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
  },
})
