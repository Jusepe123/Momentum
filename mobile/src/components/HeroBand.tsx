import { useState } from 'react'
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { colors } from '../theme'

/**
 * Brand hero artwork on its own paper band — same treatment as the web
 * dashboard banner.
 *
 * The image gets EXPLICIT numeric dimensions measured from the band via
 * onLayout. Never size it with `width: '100%' + aspectRatio`: under the New
 * Architecture (RN 0.76, Fabric) that combination is silently ignored on
 * release builds and the Image lays out at its intrinsic 1408×768dp — a
 * fullscreen zoom of the artwork's left edge that buries every button
 * (reproduced on the Pixel 7 Pro emulator before this fix).
 */

const HERO_RATIO = 768 / 1408 // height / width of assets/brand/hero.png

export function HeroBand({ style }: { style?: StyleProp<ViewStyle> }) {
  const [innerWidth, setInnerWidth] = useState(0)
  return (
    <View
      style={[styles.band, style]}
      onLayout={(e) => setInnerWidth(Math.max(0, e.nativeEvent.layout.width - 2))}
    >
      {innerWidth > 0 && (
        <Image
          source={require('../../assets/brand/hero.png')}
          style={{ width: innerWidth, height: Math.round(innerWidth * HERO_RATIO) }}
          resizeMode="cover"
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  band: {
    backgroundColor: colors.paper,
    borderWidth: 1, // onLayout width minus 2 accounts for these hairlines
    borderColor: colors.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
})
