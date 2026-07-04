import { Component, useEffect, useState, type ReactNode } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useFonts } from 'expo-font'
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './src/lib/supabase'
import { reconcileOnLaunch } from './src/tracking/recorder'
import { useRunStore } from './src/tracking/store'
import { SignInScreen } from './src/features/auth/SignInScreen'
import { RunScreen } from './src/features/run/RunScreen'
import { SummaryScreen } from './src/features/run/SummaryScreen'
import { colors } from './src/theme'

const FONT_TIMEOUT_MS = 5000

/** A crash must always produce readable text on screen — never an app frozen
 *  behind the splash or a silent blank view. */
class CrashScreen extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={[styles.root, styles.crash]}>
          <Text style={styles.crashTitle}>Something crashed</Text>
          <Text style={styles.crashMessage}>{this.state.error.message}</Text>
          <Text style={styles.crashHint}>Screenshot this and send it to José.</Text>
        </View>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <CrashScreen>
      <Root />
    </CrashScreen>
  )
}

function Root() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  })
  const [fontTimedOut, setFontTimedOut] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [runReady, setRunReady] = useState(false)
  const status = useRunStore((s) => s.status)

  // Custom fonts must never be able to blank the app: on error or timeout we
  // proceed and Android falls back to the system font.
  useEffect(() => {
    const id = setTimeout(() => setFontTimedOut(true), FONT_TIMEOUT_MS)
    return () => clearTimeout(id)
  }, [])
  useEffect(() => {
    if (fontError) console.warn('[App] font loading failed:', fontError.message)
  }, [fontError])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((e) => console.warn('[App] getSession failed:', e))
      .finally(() => setAuthReady(true))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    // Restore a live run from the snapshot / stop an orphaned location task.
    reconcileOnLaunch()
      .catch((e) => console.warn('[App] reconcileOnLaunch failed:', e))
      .finally(() => setRunReady(true))
    return () => sub.subscription.unsubscribe()
  }, [])

  const fontsSettled = fontsLoaded || !!fontError || fontTimedOut

  if (!fontsSettled || !authReady || !runReady) {
    // Visible loading state — a silent white screen is never acceptable.
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.loadingWordmark}>Momentum.</Text>
        <ActivityIndicator color={colors.ink} />
        <Text style={styles.loadingHint}>
          {!authReady ? 'Checking session…' : !runReady ? 'Restoring state…' : 'Loading fonts…'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {!session ? (
        <SignInScreen />
      ) : status === 'finished' ? (
        <SummaryScreen userId={session.user.id} />
      ) : (
        <RunScreen />
      )}
      <StatusBar style="dark" backgroundColor={colors.surface} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  // System font on purpose: the loading screen must not depend on the very
  // fonts it may be waiting for.
  loadingWordmark: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.ink,
  },
  loadingHint: {
    fontSize: 13,
    color: colors.inkDim,
  },
  // System fonts on purpose — must render under any failure mode.
  crash: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  crashTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  crashMessage: {
    fontSize: 14,
    color: colors.danger,
  },
  crashHint: {
    fontSize: 13,
    color: colors.inkDim,
  },
})
