import { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { supabase } from '../../lib/supabase'
import { listPending, removePending } from '../../upload/pending'
import { uploadRun } from '../../upload/uploadRun'
import { Button, ErrorText } from '../../components/ui'
import { SportIcon } from '../../components/SportIcon'
import { avatarUri, fetchProfile, fetchWeekDistance, type WeekDistance } from './data'
import { colors, fonts, sportColor } from '../../theme'

type Sport = 'strength' | 'run' | 'bike'

const DISCIPLINES: { sport: Sport; label: string; hint: string }[] = [
  { sport: 'strength', label: 'Strength', hint: 'Sets, reps & load' },
  { sport: 'run', label: 'Run', hint: 'Distance & pace' },
  { sport: 'bike', label: 'Bike', hint: 'Distance & speed' },
]

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** e.g. "Wednesday, Jul 5" from the device clock (Hermes-safe, no Intl). */
function todayLabel(now = new Date()): string {
  return `${WEEKDAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`
}

function formatKm(km: number): string {
  return Number.isInteger(km) ? String(km) : km.toFixed(1)
}

/**
 * The app's front door: pick a discipline to record (or log). Run and Bike open
 * the GPS recorder for that sport; Strength opens its form. Runs finished
 * offline surface here for upload, and sign-out lives here. The header shows the
 * profile photo set on the web (email initial as fallback) — display only.
 */
export function HomeScreen({
  onSelect,
  userEmail,
}: {
  onSelect: (sport: Sport) => void
  userEmail: string | null
}) {
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [week, setWeek] = useState<WeekDistance | null>(null)

  useEffect(() => {
    listPending().then((list) => setPendingCount(list.length))
  }, [])

  // The profile photo and the weekly-distance strip are non-critical: on any
  // failure we keep the fallback (initial / no strip) rather than surface an error.
  useEffect(() => {
    let cancelled = false
    fetchProfile()
      .then((p) => {
        if (!cancelled) setAvatar(avatarUri(p))
      })
      .catch(() => {})
    fetchWeekDistance()
      .then((d) => {
        if (!cancelled) setWeek(d)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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

  const initial = (userEmail?.trim()?.[0] ?? '·').toUpperCase()

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Image source={require('../../../assets/brand/logo.png')} style={styles.logo} />
        <Text style={styles.wordmark}>
          Momentum<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        {/* Profile photo set on the web; falls back to the email initial. */}
        <View style={styles.avatar} accessibilityLabel="Your profile">
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{initial}</Text>
          )}
        </View>
      </View>

      <View style={styles.greeting}>
        <Text style={styles.eyebrow}>{todayLabel()}</Text>
        <Text style={styles.heading}>What are you{'\n'}training today?</Text>
      </View>

      {week !== null && week.runKm + week.bikeKm > 0 && (
        <View style={styles.weekStrip} accessibilityLabel="Distance this week">
          <Text style={styles.weekLabel}>This week</Text>
          {week.runKm > 0 && (
            <View style={styles.weekItem}>
              <View style={[styles.weekDot, { backgroundColor: sportColor.run }]} />
              <Text style={styles.weekText}>
                Run <Text style={styles.weekValue}>{formatKm(week.runKm)} km</Text>
              </Text>
            </View>
          )}
          {week.bikeKm > 0 && (
            <View style={styles.weekItem}>
              <View style={[styles.weekDot, { backgroundColor: sportColor.bike }]} />
              <Text style={styles.weekText}>
                Bike <Text style={styles.weekValue}>{formatKm(week.bikeKm)} km</Text>
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.cards}>
        {DISCIPLINES.map((d, i) => (
          <DisciplineCard
            key={d.sport}
            index={i + 1}
            sport={d.sport}
            label={d.label}
            hint={d.hint}
            onPress={() => onSelect(d.sport)}
          />
        ))}
      </View>

      {pendingCount > 0 && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingText}>
            {pendingCount} recorded session{pendingCount > 1 ? 's' : ''} waiting to upload.
          </Text>
          <Button
            title={`Upload ${pendingCount} saved session${pendingCount > 1 ? 's' : ''}`}
            variant="ghost"
            onPress={handleSyncPending}
            busy={syncing}
          />
        </View>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      <View style={styles.spacer} />

      <Pressable
        accessibilityRole="button"
        onPress={() => supabase.auth.signOut()}
        hitSlop={12}
        style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  )
}

function DisciplineCard({
  index,
  sport,
  label,
  hint,
  onPress,
}: {
  index: number
  sport: Sport
  label: string
  hint: string
  onPress: () => void
}) {
  const hue = sportColor[sport]
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} — ${hint}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: hue + '14' }, // sport hue @ ~8%
        pressed && styles.cardPressed,
      ]}
    >
      {/* Oversized faint index numeral in the corner. */}
      <Text style={[styles.cardNumeral, { color: hue + '24' }]}>
        {String(index).padStart(2, '0')}
      </Text>
      <View style={styles.iconHolder}>
        <SportIcon sport={sport} color={hue} size={30} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardHint}>{hint}</Text>
      </View>
      <Text style={[styles.chevron, { color: hue }]}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 24,
    gap: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 30,
    height: 30,
    borderRadius: 9,
  },
  wordmark: {
    fontFamily: fonts.displaySemi,
    fontSize: 16,
    color: colors.ink,
  },
  avatar: {
    marginLeft: 'auto',
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: colors.accent + '1f', // amber @ ~12%
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarInitial: {
    fontFamily: fonts.displaySemi,
    fontSize: 15,
    color: colors.accent,
  },
  greeting: {
    gap: 6,
    marginTop: 4,
  },
  eyebrow: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  heading: {
    fontFamily: fonts.displaySemi,
    fontSize: 28,
    lineHeight: 33,
    color: colors.ink,
    letterSpacing: -0.4,
  },
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  weekLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  weekItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weekDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  weekText: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.inkDim,
  },
  weekValue: {
    fontFamily: fonts.displaySemi,
    fontSize: 14,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  cards: {
    gap: 14,
    marginTop: 4,
  },
  card: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 22,
    padding: 20,
    minHeight: 92,
  },
  cardPressed: {
    opacity: 0.82,
  },
  cardNumeral: {
    position: 'absolute',
    right: 14,
    top: -6,
    fontFamily: fonts.display,
    fontSize: 64,
    lineHeight: 64,
  },
  iconHolder: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
    zIndex: 1,
  },
  cardLabel: {
    fontFamily: fonts.displaySemi,
    fontSize: 20,
    color: colors.ink,
  },
  cardHint: {
    fontFamily: fonts.text,
    fontSize: 13,
    color: colors.inkDim,
  },
  chevron: {
    fontFamily: fonts.displaySemi,
    fontSize: 22,
    zIndex: 1,
  },
  pendingCard: {
    gap: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    padding: 16,
  },
  pendingText: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
  },
  spacer: {
    flex: 1,
    minHeight: 16,
  },
  signOut: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkFaint,
  },
})
