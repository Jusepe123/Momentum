import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
} from 'react-native'
import { colors, fonts } from '../theme'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string
  variant?: 'primary' | 'ghost' | 'danger'
  busy?: boolean
}

/** Primary buttons are ink, not amber — the accent is reserved for data/brand. */
export function Button({ title, variant = 'primary', busy, disabled, ...rest }: ButtonProps) {
  const isDisabled = disabled || busy
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        pressed && { opacity: 0.75 },
        isDisabled && { opacity: 0.45 },
      ]}
      {...rest}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'ghost' ? colors.ink : colors.panel} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'ghost' && { color: colors.ink },
            variant === 'danger' && { color: colors.panel },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  )
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.muted}
      style={styles.input}
      {...props}
    />
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  )
}

export function ErrorText({ children }: { children: string }) {
  return <Text style={styles.error}>{children}</Text>
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonDanger: {
    backgroundColor: colors.danger,
  },
  buttonText: {
    color: colors.panel,
    fontFamily: fonts.displaySemi,
    fontSize: 16,
  },
  input: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    fontFamily: fonts.text,
    fontSize: 16,
    color: colors.ink,
  },
  fieldLabel: {
    fontFamily: fonts.textSemi,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  },
  error: {
    fontFamily: fonts.text,
    fontSize: 14,
    color: colors.danger,
  },
})
