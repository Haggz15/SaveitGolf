import { View, Text, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

const BALL_SIZE = 34;
const DOME_SIZE = 58;
const NECK_SIZE = 16;
const NEEDLE_WIDTH = 22;
const NEEDLE_HEIGHT = 44;
const PIN_GREEN = '#2e8b57';
const PIN_GREEN_DARK = '#1f6b41';
const PIN_GREEN_LIGHT = '#57b880';
const NEEDLE_SILVER = '#c7ccd6';

const DIMPLES = [
  { top: 7, left: 10 },
  { top: 13, left: 19 },
  { top: 7, left: 27 },
  { top: 20, left: 10 },
  { top: 22, left: 28 },
  { top: 12, left: 5 },
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

// Round green push pin: a wide domed cap (with a highlight for a 3D look),
// a short neck tucked just under the cap, and a needle point below it.
function PushPin() {
  return (
    <View style={styles.pin}>
      <View style={styles.pinDome}>
        <View style={styles.pinDomeHighlight} />
      </View>
      <View style={styles.pinNeck} />
      <View style={styles.pinNeedle} />
    </View>
  );
}

// The SaveitGolf logo: a golf ball with "Save it" (navy) "Golf" (red) in
// Dancing Script, and a round green push pin stacked below it. Sized to
// read as the app's mark at the top of the Login and Sign Up screens.
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

      <PushPin />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 180,
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.offWhite,
    borderRadius: 28,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  ball: {
    width: BALL_SIZE,
    height: BALL_SIZE,
    borderRadius: BALL_SIZE / 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    marginRight: 10,
  },
  dimple: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.navyBorder,
  },
  markText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 34,
    lineHeight: 40,
  },
  markSaveIt: {
    color: colors.navy,
  },
  markGolf: {
    color: colors.red,
  },
  pin: {
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  pinDome: {
    width: DOME_SIZE,
    height: DOME_SIZE,
    borderRadius: DOME_SIZE / 2,
    backgroundColor: PIN_GREEN,
    borderWidth: 1,
    borderColor: PIN_GREEN_DARK,
    overflow: 'hidden',
    zIndex: 2,
  },
  pinDomeHighlight: {
    position: 'absolute',
    top: 8,
    left: 10,
    width: DOME_SIZE * 0.4,
    height: DOME_SIZE * 0.32,
    borderRadius: DOME_SIZE * 0.2,
    backgroundColor: PIN_GREEN_LIGHT,
    opacity: 0.7,
  },
  pinNeck: {
    width: NECK_SIZE,
    height: NECK_SIZE * 0.7,
    backgroundColor: PIN_GREEN_DARK,
    marginTop: -6,
    zIndex: 1,
  },
  pinNeedle: {
    marginTop: -1,
    width: 0,
    height: 0,
    borderLeftWidth: NEEDLE_WIDTH / 2,
    borderRightWidth: NEEDLE_WIDTH / 2,
    borderTopWidth: NEEDLE_HEIGHT,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: NEEDLE_SILVER,
  },
});
