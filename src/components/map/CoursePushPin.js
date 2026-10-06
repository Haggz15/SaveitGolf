import Svg, { Defs, RadialGradient, Stop, Ellipse, Rect, Path } from 'react-native-svg';
import colors from '../../theme/colors';

// Push pin matching the app logo: wide oval dome cap with a shine highlight,
// a short rounded neck, and a sharp needle whose tip sits at the bottom
// center (markers anchor at { x: 0.5, y: 1 }).
// The shine gradient is white-only so one shared id works for every pin
// color, even when many pins render into the same DOM on web.
export default function CoursePushPin({ color = colors.red, size = 28 }) {
  const height = (size * 88) / 60;
  return (
    <Svg width={size} height={height} viewBox="0 0 60 88">
      <Defs>
        <RadialGradient id="coursePushPinShine" cx="0.35" cy="0.3" r="0.6">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.85} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.25} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {/* Needle */}
      <Path d="M25.5 46 L34.5 46 L30 87 Z" fill="#C9CED6" stroke="#8A919C" strokeWidth={1} strokeLinejoin="round" />
      {/* Neck */}
      <Rect x={22} y={36} width={16} height={13} rx={4} fill={color} stroke={colors.white} strokeWidth={1.5} />
      <Rect x={22} y={36} width={16} height={13} rx={4} fill="#000000" opacity={0.2} />
      {/* Dome cap */}
      <Ellipse cx={30} cy={22} rx={28} ry={19} fill={color} stroke={colors.white} strokeWidth={2} />
      <Ellipse cx={30} cy={22} rx={28} ry={19} fill="url(#coursePushPinShine)" />
    </Svg>
  );
}
