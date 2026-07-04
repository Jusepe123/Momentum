import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { useFonts } from 'expo-font'
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './src/lib/supabase'
import { SignInScreen } from './src/features/auth/SignInScreen'
import { Button } from './src/components/ui'
import { colors, fonts } from './src/theme'

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  })
  const [session, setSession] = useState<Session | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!fontsLoaded || !authReady) {
    return <View style={styles.root} />
  }

  return (
    <View style={styles.root}>
      {session ? <SignedInPlaceholder email={session.user.email ?? ''} /> : <SignInScreen />}
      <StatusBar style="dark" backgroundColor={colors.surface} />
    </View>
  )
}

// Replaced by RunScreen in the tracking phase.
function SignedInPlaceholder({ email }: { email: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>
        Momentum<Text style={{ color: colors.accent }}>.</Text>
      </Text>
      <Text style={styles.subtitle}>Signed in as {email}</Text>
      <Button title="Sign out" variant="ghost" onPress={() => supabase.auth.signOut()} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
  },
})
