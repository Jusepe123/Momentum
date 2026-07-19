import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Button, ErrorText, Input } from '../../components/ui'
import { SportIcon } from '../../components/SportIcon'
import { colors, fonts, sportColor } from '../../theme'
import { uuid4 } from '../../lib/uuid'
import { expandGroups, groupSets } from '../../lib/setGroups'
import { ExercisePicker } from './ExercisePicker'
import {
  fetchExercises,
  fetchRoutines,
  uploadStrength,
  type Exercise,
  type RoutineWithSets,
} from './data'

/** Same four effort levels as the web log form + the run summary — persist as rpe. */
const EFFORT_LEVELS = [
  { rpe: 3, label: 'Easy' },
  { rpe: 5, label: 'Moderate' },
  { rpe: 7, label: 'Hard' },
  { rpe: 9, label: 'Max' },
] as const

const DURATION_PRESETS = [30, 45, 60, 90] as const

/** One card = one exercise: N identical sets at one weight (same grouped model
 *  as the web forms). `key` is a stable local id so removing a card never
 *  reshuffles React keys. */
interface GroupRow {
  key: string
  exerciseId: string | null
  sets: string
  reps: string
  weight: string
}

function blankRow(): GroupRow {
  return { key: uuid4(), exerciseId: null, sets: '3', reps: '', weight: '' }
}

/** Parse a weight field to kg. Empty = 0 (bodyweight). Accepts a comma decimal
 *  separator (the decimal-pad shows one in comma-locales like es), which raw
 *  `Number()` would turn into NaN → a NOT NULL violation on strength_sets. */
function parseWeightKg(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return 0
  const n = Number(trimmed.replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Strength logging — create-only. Start from a saved routine (prefills editable
 * sets) or add free sets, pick an effort + duration, and upload as an ordinary
 * strength session. History and editing stay on the web app.
 */
export function StrengthScreen({ onBack }: { onBack: () => void }) {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [routines, setRoutines] = useState<RoutineWithSets[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [rows, setRows] = useState<GroupRow[]>([blankRow()])
  const [rpe, setRpe] = useState<number | null>(null)
  const [durationMin, setDurationMin] = useState<number | null>(null)
  const [customDuration, setCustomDuration] = useState('')
  const [notes, setNotes] = useState('')

  const [pickerFor, setPickerFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchExercises(), fetchRoutines()])
      .then(([ex, rt]) => {
        if (cancelled) return
        setExercises(ex)
        setRoutines(rt)
      })
      .catch((e) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Could not load your data.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const exerciseName = (id: string | null) =>
    id ? (exercises.find((e) => e.id === id)?.name ?? 'Unknown exercise') : null

  function applyRoutine(routine: RoutineWithSets) {
    if (routine.routine_sets.length === 0) {
      setRows([blankRow()])
      return
    }
    setRows(
      groupSets(
        routine.routine_sets.map((s) => ({
          exerciseId: s.exercise_id,
          weightKg: s.weight_kg,
          reps: s.reps,
        })),
      ).map((g) => ({
        key: uuid4(),
        exerciseId: g.exerciseId,
        sets: String(g.numSets),
        reps: String(g.reps),
        weight: g.weightKg === null ? '' : String(g.weightKg),
      })),
    )
  }

  function updateRow(key: string, patch: Partial<GroupRow>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setRows((rs) => (rs.length <= 1 ? rs : rs.filter((r) => r.key !== key)))
  }

  const effectiveDuration =
    durationMin ?? (customDuration.trim() ? Number(customDuration) : null)

  // A card counts as ready when it has an exercise, 1–20 sets, and positive reps.
  const readyGroups = rows.filter((r) => {
    const sets = Number(r.sets)
    return r.exerciseId && Number.isInteger(sets) && sets >= 1 && sets <= 20 && Number(r.reps) > 0
  })
  const canSave =
    readyGroups.length > 0 &&
    rpe !== null &&
    effectiveDuration !== null &&
    effectiveDuration > 0 &&
    !saving

  async function handleSave() {
    if (rpe === null || effectiveDuration === null || effectiveDuration <= 0) return
    setError(null)
    setSaving(true)
    try {
      await uploadStrength({
        durationMin: Math.round(effectiveDuration),
        rpe,
        notes,
        sets: expandGroups(
          readyGroups.map((r) => ({
            exerciseId: r.exerciseId!,
            numSets: Number(r.sets),
            weightKg: parseWeightKg(r.weight),
            reps: Number(r.reps),
          })),
        ),
      })
      onBack() // back to Home; history lives on the web app
    } catch (e) {
      setError(
        `${e instanceof Error ? e.message : 'Save failed.'} Nothing was lost — check your signal and try again.`,
      )
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.loadingText}>Loading your exercises…</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          onPress={onBack}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={[styles.sportBadge, { borderColor: sportColor.strength }]}>
          <SportIcon sport="strength" color={sportColor.strength} size={18} />
          <Text style={[styles.sportBadgeText, { color: sportColor.strength }]}>Strength</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {loadError && <ErrorText>{loadError}</ErrorText>}

      {routines.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Start from a routine</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.routineRow}
          >
            {routines.map((r) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                onPress={() => applyRoutine(r)}
                style={({ pressed }) => [styles.routineChip, pressed && styles.chipPressed]}
              >
                <Text style={styles.routineChipText}>{r.name}</Text>
                <Text style={styles.routineChipCount}>
                  {(() => {
                    const n = new Set(r.routine_sets.map((s) => s.exercise_id)).size
                    return `${n} exercise${n === 1 ? '' : 's'}`
                  })()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Exercises</Text>
        {rows.map((row, i) => (
          <View key={row.key} style={styles.setCard}>
            <View style={styles.setCardHeader}>
              <Text style={styles.setIndex}>Exercise {i + 1}</Text>
              {rows.length > 1 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove exercise ${i + 1}`}
                  onPress={() => removeRow(row.key)}
                  hitSlop={10}
                >
                  <Text style={styles.remove}>Remove</Text>
                </Pressable>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerFor(row.key)}
              style={styles.exerciseBtn}
            >
              <Text style={[styles.exerciseBtnText, !row.exerciseId && styles.exercisePlaceholder]}>
                {exerciseName(row.exerciseId) ?? 'Choose exercise'}
              </Text>
              <Text style={styles.exerciseChevron}>›</Text>
            </Pressable>

            <View style={styles.numRow}>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>Sets</Text>
                <TextInput
                  value={row.sets}
                  onChangeText={(t) => updateRow(row.key, { sets: t.replace(/[^0-9]/g, '') })}
                  placeholder="3"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  style={styles.numInput}
                />
              </View>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>Reps</Text>
                <TextInput
                  value={row.reps}
                  onChangeText={(t) => updateRow(row.key, { reps: t.replace(/[^0-9]/g, '') })}
                  placeholder="0"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="number-pad"
                  style={styles.numInput}
                />
              </View>
              <View style={styles.numField}>
                <Text style={styles.numLabel}>Weight (kg)</Text>
                <TextInput
                  value={row.weight}
                  onChangeText={(t) => updateRow(row.key, { weight: t })}
                  placeholder="0"
                  placeholderTextColor={colors.inkFaint}
                  keyboardType="decimal-pad"
                  style={styles.numInput}
                />
              </View>
            </View>
            <Text style={styles.groupHint}>Weight applies to every set of this exercise.</Text>
          </View>
        ))}
        <Button
          title="+ Add exercise"
          variant="ghost"
          onPress={() => setRows((rs) => [...rs, blankRow()])}
        />
      </View>

      <View style={styles.section}>
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
                style={[styles.effortChip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {level.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Duration (minutes)</Text>
        <View style={styles.chips}>
          {DURATION_PRESETS.map((d) => {
            const selected = durationMin === d
            return (
              <Pressable
                key={d}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => {
                  setDurationMin(d)
                  setCustomDuration('')
                }}
                style={[styles.durationChip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{d}</Text>
              </Pressable>
            )
          })}
          <TextInput
            value={customDuration}
            onChangeText={(t) => {
              setCustomDuration(t.replace(/[^0-9]/g, ''))
              setDurationMin(null)
            }}
            placeholder="Custom"
            placeholderTextColor={colors.inkFaint}
            keyboardType="number-pad"
            style={[styles.durationChip, styles.customInput, customDuration ? styles.customActive : null]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Notes (optional)</Text>
        <Input
          value={notes}
          onChangeText={setNotes}
          placeholder="How did it go?"
          multiline
          numberOfLines={3}
          style={styles.notes}
        />
      </View>

      {error && <ErrorText>{error}</ErrorText>}

      <Button title="Save session" onPress={handleSave} busy={saving} disabled={!canSave} />
      {!canSave && !saving && (
        <Text style={styles.hint}>
          Add at least one exercise with sets and reps, pick an effort, and set a duration.
        </Text>
      )}

      <ExercisePicker
        visible={pickerFor !== null}
        exercises={exercises}
        onClose={() => setPickerFor(null)}
        onPick={(ex) => {
          if (pickerFor) updateRow(pickerFor, { exerciseId: ex.id })
          setPickerFor(null)
        }}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
  },
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 48,
    gap: 20,
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
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkDim,
  },
  routineRow: {
    gap: 8,
    paddingRight: 8,
  },
  routineChip: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 110,
  },
  routineChipText: {
    fontFamily: fonts.textSemi,
    fontSize: 15,
    color: colors.ink,
  },
  routineChipCount: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.inkFaint,
    marginTop: 2,
  },
  chipPressed: {
    opacity: 0.8,
    backgroundColor: colors.paper,
  },
  setCard: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  setCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  setIndex: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    color: colors.inkDim,
  },
  remove: {
    fontFamily: fonts.textSemi,
    fontSize: 13,
    color: colors.danger,
  },
  exerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  exerciseBtnText: {
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.ink,
    flex: 1,
  },
  exercisePlaceholder: {
    color: colors.inkFaint,
  },
  exerciseChevron: {
    fontFamily: fonts.display,
    fontSize: 20,
    color: colors.inkFaint,
  },
  numRow: {
    flexDirection: 'row',
    gap: 12,
  },
  numField: {
    flex: 1,
    gap: 6,
  },
  numLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.inkDim,
  },
  numInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontFamily: fonts.displayMedium,
    fontSize: 18,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  effortChip: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minWidth: 70,
  },
  durationChip: {
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  customInput: {
    minWidth: 96,
    fontFamily: fonts.text,
    fontSize: 15,
    color: colors.ink,
    textAlign: 'center',
  },
  customActive: {
    borderColor: colors.ink,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontFamily: fonts.textSemi,
    fontSize: 15,
    color: colors.ink,
  },
  chipTextSelected: {
    color: colors.panel,
  },
  notes: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  hint: {
    fontFamily: fonts.text,
    fontSize: 12,
    color: colors.inkFaint,
    textAlign: 'center',
  },
  groupHint: {
    fontFamily: fonts.text,
    fontSize: 11,
    color: colors.inkFaint,
  },
})
