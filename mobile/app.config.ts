import type { ExpoConfig } from 'expo/config'

/**
 * Momentum mobile — Android run recorder companion for the Momentum web app.
 * Background GPS requires a dev build (expo-dev-client); it does NOT work in Expo Go.
 */
const config: ExpoConfig = {
  name: 'Momentum',
  slug: 'momentum-mobile',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#f7f7f5',
  },
  android: {
    package: 'com.jusepe.momentum',
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#f7f7f5',
    },
    // Android 13+ runtime notification permission — needed so the foreground
    // service notification (the thing that keeps GPS alive) is visible.
    permissions: ['android.permission.POST_NOTIFICATIONS'],
  },
  plugins: [
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Momentum uses your location to measure run distance, including while the screen is off.',
        isAndroidBackgroundLocationEnabled: true,
        // Adds FOREGROUND_SERVICE + FOREGROUND_SERVICE_LOCATION (Android 14+ requirement)
        isAndroidForegroundServiceEnabled: true,
      },
    ],
  ],
}

export default config
