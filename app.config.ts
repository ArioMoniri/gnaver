import type { ExpoConfig } from 'expo/config';

/**
 * Dynamic Expo config. Secrets are injected from the environment at build time
 * and are NEVER committed:
 *   - GOOGLE_MAPS_ANDROID_KEY  → native Google Maps SDK key (Android only; iOS uses Apple Maps)
 * Client-side service keys (Places / Directions / Weather / LLM) are read at
 * runtime from EXPO_PUBLIC_* vars in src/services/config.ts.
 *
 * Copy .env.example → .env and fill in your keys. See docs/SETUP.md.
 */

const config: ExpoConfig = {
  name: 'Gnaver',
  slug: 'gnaver',
  owner: 'ariomoniri',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gnaver',
  userInterfaceStyle: 'automatic',
  ios: {
    icon: './assets/expo.icon',
    supportsTablet: true,
    bundleIdentifier: 'com.ariomoniri.gnaver',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Gnaver uses your location to start routes from where you are and show you on the map.',
    },
  },
  android: {
    package: 'com.ariomoniri.gnaver',
    adaptiveIcon: {
      backgroundColor: '#FFFFFF',
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    config: {
      googleMaps: {
        apiKey: process.env.GOOGLE_MAPS_ANDROID_KEY ?? '',
      },
    },
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-font',
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FFFFFF',
        image: './assets/images/splash-icon.png',
        imageWidth: 96,
      },
    ],
    [
      'expo-maps',
      {
        requestLocationPermission: true,
        locationPermission: 'Allow Gnaver to use your location to plan routes from where you are.',
      },
    ],
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Gnaver to use your location to plan routes from where you are.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID ?? 'd69605ff-581a-4d5b-b357-f97e2e853212' },
  },
};

export default config;
