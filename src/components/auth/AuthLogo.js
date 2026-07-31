import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

const LOGO_WIDTH = 120;

const DIMPLES = [
  { top: 5, left: 8 },
  { top: 10, left: 15 },
  { top: 5, left: 21 },
  { top: 15, left: 8 },
  { top: 17, left: 22 },
  { top: 9, left: 4 },
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

// The logo mark: golf ball + "Save it" (navy) "Golf" (red) in Dancing
// Script, on a light backdrop so the navy half stays legible against the
// navy screen background. The plain wordmark/tagline below it (white on
// navy) stay as-is.
export default function AuthLogo() {
  return (
    <View style={styles.container}>
      <View style={styles.mark}>
        <GolfBall />
        <Text style={styles.markText}>
          <Text style={styles.markSaveIt}>Save it</Text>
          <Text style={styles.markGolf}> Golf</Text>
        </Text>
      </View>

      <Text style={styles.wordmark}>SaveitGolf</Text>
      <Text style={styles.tagline}>Discover · Play · Save It</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  mark: {
    width: LOGO_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
    borderRadius: 24,
    paddingVertical: 9,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  ball: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    marginRight: 6,
  },
  dimple: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: colors.navyBorder,
  },
  markText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 22,
    lineHeight: 26,
  },
  markSaveIt: {
    color: colors.navy,
  },
  markGolf: {
    color: colors.red,
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
