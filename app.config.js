require('dotenv/config');

module.exports = {
  expo: {
    name: 'SaveitGolf',
    slug: 'SaveitGolf',
    owner: 'saveitgolf',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'dark',
    backgroundColor: '#0d1f3c',
    ios: {
      supportsTablet: true,
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#0d1f3c',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      'expo-font',
      'expo-dev-client',
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0d1f3c',
          image: './assets/splash-icon.png',
          imageWidth: 200,
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'SaveitGolf uses your location to show nearby golf courses on the map.',
        },
      ],
    ],
    extra: {
      golfCourseApiKey: process.env.GOLF_COURSE_API_KEY,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      eas: {
        projectId: '48ad35b3-294a-4970-b8fe-612a50cd94fb',
      },
    },
  },
};
