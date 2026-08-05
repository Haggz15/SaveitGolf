import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import colors from '../../theme/colors';

// Level 1 (zoomed-out full-US) pin — a green push pin, larger than a course
// flag pin so it reads clearly at the whole-US zoom, with the state
// abbreviation on a small label underneath.
export const STATE_PIN_WIDTH = 34;
export const STATE_PIN_HEIGHT = 44;

export default function StatePushPin({ abbr }) {
  return (
    <View style={styles.wrap}>
      <Svg width={STATE_PIN_WIDTH} height={STATE_PIN_HEIGHT} viewBox="0 0 34 44">
        <Path
          d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z"
          fill={colors.green}
          stroke={colors.white}
          strokeWidth={1.5}
        />
        <Circle cx={17} cy={17} r={6.5} fill={colors.navy} />
      </Svg>
      <View style={[styles.label, { borderColor: colors.green }]}>
        <Text style={styles.labelText}>{abbr}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
  },
  label: {
    marginTop: -4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: colors.navy,
    borderWidth: 1,
  },
  labelText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
