import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Input } from '../../components/ui'
import { colors, fonts } from '../../theme'
import type { Exercise } from './data'

/**
 * Full-screen modal exercise picker — React Native has no native <select>, so a
 * searchable list is the idiom. Filters the combined global-seed + own-exercise
 * list; picking one calls onPick and closes.
 */
export function ExercisePicker({
  visible,
  exercises,
  onPick,
  onClose,
}: {
  visible: boolean
  exercises: Exercise[]
  onPick: (exercise: Exercise) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return exercises
    return exercises.filter((e) => e.name.toLowerCase().includes(q))
  }, [exercises, query])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose exercise</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            hitSlop={12}
          >
            <Text style={styles.close}>Done</Text>
          </Pressable>
        </View>

        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Search exercises…"
          autoCorrect={false}
          autoCapitalize="none"
        />

        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No exercises match “{query}”.</Text>
          ) : (
            filtered.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                onPress={() => {
                  onPick(e)
                  setQuery('')
                }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <Text style={styles.rowText}>{e.name}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 24,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: 24,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  close: {
    fontFamily: fonts.textSemi,
    fontSize: 16,
    color: colors.ink,
  },
  list: {
    flex: 1,
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowPressed: {
    backgroundColor: colors.paper,
  },
  rowText: {
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.ink,
  },
  empty: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkFaint,
    paddingVertical: 20,
  },
})
