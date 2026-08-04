import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Ellipse,
  Polygon,
  Rect,
  Defs,
  RadialGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

// Native SVG coordinate space — text is authored at its true size (46 / 52)
// in this space, then the whole mark is scaled down to LOGO_DISPLAY_WIDTH
// when rendered so it reads correctly at auth-screen scale.
const LOGO_WIDTH = 304;
const LOGO_HEIGHT = 441;
const LOGO_DISPLAY_WIDTH = 130;
const LOGO_DISPLAY_HEIGHT = Math.round(LOGO_HEIGHT * (LOGO_DISPLAY_WIDTH / LOGO_WIDTH));

const BALL_CX = 152;
const BALL_CY = 144;
const BALL_R = 122;

const PIN_GREEN = '#4dd860';
const PIN_GREEN_LIGHT = '#8bf09a';
const PIN_GREEN_DARK = '#2e8b3a';
const NEEDLE_COLOR = '#1a1a1a';

// Dense hex-grid dimple pattern clipped to the ball's circle, generated once
// at module load so every AuthLogo instance reuses the same point set.
function generateDimples(cx, cy, r) {
  const dimples = [];
  const dx = 9;
  const dy = 8;
  const padding = 5;
  for (let row = -r; row <= r; row += dy) {
    const offset = Math.round(row / dy) % 2 === 0 ? 0 : dx / 2;
    for (let col = -r; col <= r; col += dx) {
      const x = col + offset;
      const y = row;
      if (Math.sqrt(x * x + y * y) <= r - padding) {
        dimples.push({ x: cx + x, y: cy + y });
      }
    }
  }
  return dimples;
}

const DIMPLES = generateDimples(BALL_CX, BALL_CY, BALL_R);

function GolfBallMark() {
  return (
    <Svg
      width={LOGO_DISPLAY_WIDTH}
      height={LOGO_DISPLAY_HEIGHT}
      viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}
    >
      <Defs>
        <RadialGradient id="ballShine" cx="34%" cy="28%" r="70%">
          <Stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <Stop offset="55%" stopColor="#ffffff" stopOpacity="0.3" />
          <Stop offset="100%" stopColor="#c9ccd2" stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Ball base */}
      <Circle cx={BALL_CX} cy={BALL_CY} r={BALL_R} fill="#f4f5f7" stroke="#b7bcc4" strokeWidth={1} />

      {/* Dense dimple pattern */}
      {DIMPLES.map((d, i) => (
        <Circle key={i} cx={d.x} cy={d.y} r={1.5} fill="#c9ccd2" opacity={0.85} />
      ))}

      {/* Radial gradient shine overlay */}
      <Circle cx={BALL_CX} cy={BALL_CY} r={BALL_R} fill="url(#ballShine)" />

      {/* "Save it" — upper half of the ball */}
      <SvgText
        x={BALL_CX}
        y={110}
        fontFamily="DancingScript_700Bold"
        fontSize={46}
        fill="#0d1f3c"
        textAnchor="middle"
      >
        Save it
      </SvgText>

      {/* "Golf" — lower half of the ball */}
      <SvgText
        x={BALL_CX}
        y={209}
        fontFamily="DancingScript_700Bold"
        fontSize={52}
        fill="#c0001a"
        textAnchor="middle"
      >
        Golf
      </SvgText>

      {/* Push pin — round dome cap */}
      <Ellipse cx={BALL_CX} cy={315} rx={57} ry={38} fill={PIN_GREEN} stroke={PIN_GREEN_DARK} strokeWidth={1} />

      {/* Subtle shadow where the dome meets the neck */}
      <Ellipse cx={BALL_CX} cy={349} rx={48} ry={8} fill="#1a1a1a" opacity={0.18} />

      {/* Upper-left highlight on the dome */}
      <Ellipse cx={133} cy={302} rx={19} ry={13} fill={PIN_GREEN_LIGHT} opacity={0.6} />

      {/* Neck */}
      <Rect x={133} y={346} width={38} height={27} rx={4} ry={4} fill={PIN_GREEN_DARK} />

      {/* Thin dark rect behind the needle for depth */}
      <Rect x={148} y={372} width={8} height={54} fill={NEEDLE_COLOR} opacity={0.35} />

      {/* Needle point */}
      <Polygon points="133,372 171,372 152,422" fill={NEEDLE_COLOR} />
    </Svg>
  );
}

// The SaveitGolf logo: a dimpled golf ball with "Save it" (navy) / "Golf"
// (red) lettering across its face, a round green push pin below it, and the
// tagline underneath. Sized to read as the app's mark at the top of the
// Login and Sign Up screens.
export default function AuthLogo() {
  return (
    <View style={styles.container}>
      <GolfBallMark />
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
    letterSpacing: 3,
    marginTop: 2,
  },
});
