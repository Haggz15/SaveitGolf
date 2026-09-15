import { useCallback, useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';
import { BarlowCondensed_700Bold, BarlowCondensed_800ExtraBold } from '@expo-google-fonts/barlow-condensed';
import { Courgette_400Regular } from '@expo-google-fonts/courgette';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Oswald_600SemiBold, Oswald_700Bold } from '@expo-google-fonts/oswald';

import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { NotificationsProvider } from './src/context/NotificationsContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import colors from './src/theme/colors';
import { version as appVersion } from './package.json';

SplashScreen.preventAutoHideAsync();

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      const lastVersion = localStorage.getItem('appVersion');
      if (lastVersion !== appVersion) {
        localStorage.setItem('appVersion', appVersion);
        // Skip reload on a first-ever visit, only when the version actually changed
        if (lastVersion !== null) {
          window.location.reload();
        }
      }
    }
  }, []);

  const [fontsLoaded] = useFonts({
    DancingScript_700Bold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
    Courgette_400Regular,
    Cinzel_700Bold,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <View style={styles.container} onLayout={onLayoutRootView}>
          <StatusBar style="light" />
          <AuthProvider>
            <NotificationsProvider>
              <RootNavigator />
            </NotificationsProvider>
          </AuthProvider>
        </View>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
});
