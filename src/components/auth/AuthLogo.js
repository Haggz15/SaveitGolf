import { View, Text, Image, StyleSheet } from 'react-native';

const LOGO_DISPLAY_WIDTH = 155;

// The SaveitGolf logo (the app icon image) with the tagline underneath.
// Sized to read as the app's mark at the top of the Login and Sign Up
// screens.
export default function AuthLogo() {
  return (
    <View style={styles.container}>
      <Image source={require('../../../assets/icon.png')} style={styles.logo} />
      <Text style={styles.tagline}>DISCOVER · PLAY · SAVE IT</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: LOGO_DISPLAY_WIDTH,
    height: LOGO_DISPLAY_WIDTH,
    borderRadius: 24,
  },
  tagline: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 10,
    color: '#6a8ab0',
    letterSpacing: 1.2,
    marginTop: 8,
  },
});
