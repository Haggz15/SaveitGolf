import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

const DIMPLES = [
  { top: 6, left: 12 },
  { top: 14, left: 22 },
  { top: 6, left: 28 },
  { top: 20, left: 12 },
  { top: 22, left: 30 },
  { top: 12, left: 8 },
];

function GolfBall() {
  return (
    <View style={styles.ball}>
      {DIMPLES.map((d, i) => (
        <View key={i} style={[styles.dimple, { top: d.top, left: d.left }]} />
      ))}
    </View>
  );
}

export default function AuthLogo() {
  return (
    <View style={styles.container}>
      <GolfBall />
      <Text style={styles.wordmark}>SaveitGolf</Text>
      <Text style={styles.tagline}>Discover · Play · Save It</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ball: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  dimple: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
  },
  wordmark: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 40,
    color: colors.white,
    lineHeight: 48,
  },
  tagline: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.gold,
    marginTop: 4,
    textTransform: 'uppercase',
  },
});
