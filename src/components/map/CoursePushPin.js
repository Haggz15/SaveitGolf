import Svg, { Path, Circle } from 'react-native-svg';
import colors from '../../theme/colors';

// Same teardrop shape as StatePushPin, minus the state-abbreviation label —
// used for individual course markers so they read as branded push pins
// instead of react-native-maps' default round pin/flag glyphs.
export default function CoursePushPin({ color = colors.red, size = 28 }) {
  const height = (size * 44) / 34;
  return (
    <Svg width={size} height={height} viewBox="0 0 34 44">
      <Path
        d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z"
        fill={color}
        stroke={colors.white}
        strokeWidth={1.5}
      />
      <Circle cx={17} cy={17} r={6.5} fill={colors.navy} />
    </Svg>
  );
}
