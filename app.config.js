require('dotenv/config');

console.log(
  '[app.config.js] SUPABASE_URL is',
  process.env.SUPABASE_URL ? 'defined' : 'undefined',
  '| SUPABASE_ANON_KEY is',
  process.env.SUPABASE_ANON_KEY ? 'defined' : 'undefined'
);

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
    scheme: 'saveitgolf',
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
      [
        'expo-media-library',
        {
          photosPermission: 'SaveitGolf saves your scorecard images to your photo library.',
          savePhotosPermission: 'SaveitGolf saves your scorecard images to your photo library.',
        },
      ],
      'expo-sharing',
      [
        'expo-image-picker',
        {
          photosPermission: 'SaveitGolf uses your photo library so you can add a photo to your scorecard.',
        },
      ],
      'expo-video',
    ],
    extra: {
      golfCourseApiKey: process.env.GOLF_COURSE_API_KEY,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
      eas: {
        projectId: '48ad35b3-294a-4970-b8fe-612a50cd94fb',
      },
    },
  },
};
