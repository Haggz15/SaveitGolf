import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';

// react-native-maps has no web renderer (it crashes on import there), so web
// gets this placeholder. The real interactive map lives in MapScreen.js and
// runs on iOS/Android via a custom dev client.
export default function MapScreen() {
  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.body}>
        <Ionicons name="phone-portrait-outline" size={36} color={colors.muted} />
        <Text style={styles.title}>Map is a native-only feature</Text>
        <Text style={styles.subtitle}>
          The interactive course map uses react-native-maps, which doesn't run in a
          web browser. Open SaveitGolf on iOS or Android (via a custom dev client) to
          see it.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
});
