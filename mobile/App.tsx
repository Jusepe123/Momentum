import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'
import { useFonts } from 'expo-font'
import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk'
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter'
import { colors, fonts } from './src/theme'

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  })

  if (!fontsLoaded) {
    return <View style={styles.root} />
  }

  return (
    <View style={styles.root}>
      <Text style={styles.title}>
        Momentum<Text style={{ color: colors.accent }}>.</Text>
      </Text>
      <Text style={styles.subtitle}>Run recorder — scaffold OK</Text>
      <StatusBar style="dark" backgroundColor={colors.surface} />
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
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
