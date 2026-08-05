import { View, Text, StyleSheet } from 'react-native';
import GolfBallMark, { useGolfBallFont } from '../common/GolfBallMark';

const LOGO_DISPLAY_WIDTH = 155;

// The SaveitGolf logo: a dimpled golf ball with "Save it" (navy) / "Golf"
// (red) lettering across its face, a round green push pin below it, and the
// tagline underneath. Sized to read as the app's mark at the top of the
// Login and Sign Up screens.
export default function AuthLogo() {
  const fontFamily = useGolfBallFont();

  return (
    <View style={styles.container}>
      <GolfBallMark fontFamily={fontFamily} displayWidth={LOGO_DISPLAY_WIDTH} />
      <Text style={styles.tagline}>DISCOVER · PLAY · SAVE IT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 10,
    color: '#6a8ab0',
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
