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
  extra: {
    eas: {
      projectId: 'bf08221c-6dbf-45af-9167-80fb56b2b2c0',
    },
  },
  plugins: [
    // SDK 52 splash goes through this plugin (Android 12 SplashScreen API).
    // imageWidth is mandatory sanity: a raw 1024px image renders as a huge
    // cropped zoom in the fixed center slot (seen on device).
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 160,
        resizeMode: 'contain',
        backgroundColor: '#f7f7f5',
      },
    ],
    ['expo-notifications', { color: '#0d9488' }],
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
