import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'
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

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  })
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [runReady, setRunReady] = useState(false)
  const status = useRunStore((s) => s.status)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    // Restore a live run from the snapshot / stop an orphaned location task.
    reconcileOnLaunch().finally(() => setRunReady(true))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!fontsLoaded || !authReady || !runReady) {
    return <View style={styles.root} />
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
})
