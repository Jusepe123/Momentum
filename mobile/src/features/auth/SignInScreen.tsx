import { useState } from 'react'
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { supabase } from '../../lib/supabase'
import { colors, fonts } from '../../theme'
import { Button, ErrorText, Field, Input } from '../../components/ui'
import { HeroBand } from '../../components/HeroBand'

/**
 * Sign in only — accounts are created on the web app. Same Supabase project,
 * so the phone writes sessions the dashboard picks up under the same RLS.
 */
export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSignIn() {
    setError(null)
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    setBusy(false)
    if (signInError) {
      setError(signInError.message)
    }
    // Success needs no navigation: App.tsx re-renders on the auth event.
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Image source={require('../../../assets/brand/logo.png')} style={styles.logo} />
        <Text style={styles.title}>
          Momentum<Text style={{ color: colors.accent }}>.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Sign in with your Momentum account to record runs.
        </Text>
        <Field label="Email">
          <Input
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password">
          <Input
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            placeholder="••••••••"
            onSubmitEditing={handleSignIn}
          />
        </Field>
        {error && <ErrorText>{error}</ErrorText>}
        <Button title="Sign in" onPress={handleSignIn} busy={busy} />
      </View>

      <HeroBand style={styles.heroBand} />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    gap: 16,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  heroBand: {
    marginTop: 28,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 34,
    color: colors.ink,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.inkDim,
    marginBottom: 8,
  },
})
