import { Platform } from 'react-native';
import Svg, { Circle, Ellipse, Polygon, Rect, Text as SvgText, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useFonts } from 'expo-font';
import DancingScriptBold from '../../../assets/fonts/DancingScript-Bold.ttf';

// The "Save it" / "Golf" wordmark is rendered as real SVG <Text> (inside the
// same <Svg> as the ball art below) so its x/y/text-anchor sit in the exact
// same coordinate space as the ball and scale with it. The font is bundled
// locally and loaded via expo-font here — rather than relying on the
// app-wide @expo-google-fonts Google Fonts loader — so it renders correctly
// on web regardless of network conditions.
const SCRIPT_FONT = 'DancingScript-Bold';
// react-native's Text/Svg Text only match a single registered font family —
// a CSS-style fallback stack only works on web (react-native-web forwards
// fontFamily straight to CSS), so it's added there only.
const scriptFontFamily = (loadedFont) =>
  Platform.select({
    web: `${loadedFont || SCRIPT_FONT}, "Dancing Script", cursive`,
    default: loadedFont,
  });

// Any consumer that renders <GolfBallMark> needs this font ready first — call
// once per component tree and pass the result down as the `fontFamily` prop.
export function useGolfBallFont() {
  const [fontsLoaded] = useFonts({ [SCRIPT_FONT]: DancingScriptBold });
  // Falls back to the system font for one frame while the local TTF loads,
  // rather than hiding the whole logo — the swap to script is unnoticeable.
  return scriptFontFamily(fontsLoaded ? SCRIPT_FONT : undefined);
}

// SVG coordinate space — the ball, wordmark, and pin are all authored here,
// then scaled to whatever displayWidth the caller asks for.
const LOGO_WIDTH = 300;
const LOGO_HEIGHT = 370;

const BALL_CX = 150;
const BALL_CY = 118;
const BALL_R = 112;

const PIN_GREEN = '#4dd860';
const PIN_GREEN_LIGHT = '#8bf09a';
const PIN_GREEN_DARK = '#2e8b3a';
const NEEDLE_COLOR = '#1a1a1a';

// Dense hex-grid dimple pattern clipped to the ball's circle, generated once
// at module load so every GolfBallMark instance reuses the same point set.
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

// The SaveitGolf ball mark: a dimpled golf ball with "Save it" (navy) /
// "Golf" (red) lettering across its face and a round green push pin below
// it. Used full-size on the Login/Sign Up screens (see AuthLogo) and scaled
// down as a subtle watermark on exported scorecards.
export default function GolfBallMark({ fontFamily, displayWidth = 155 }) {
  const displayHeight = Math.round(LOGO_HEIGHT * (displayWidth / LOGO_WIDTH));

  return (
    <Svg width={displayWidth} height={displayHeight} viewBox={`0 0 ${LOGO_WIDTH} ${LOGO_HEIGHT}`}>
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

      {/* Wordmark — real SVG text so it sits precisely inside the ball,
          scaling with everything else rather than needing separate
          display-pixel positioning. */}
      <SvgText
        x={150}
        y={105}
        fontFamily={fontFamily}
        fontSize={48}
        fontWeight="700"
        fill="#0d1f3c"
        textAnchor="middle"
      >
        Save it
      </SvgText>
      <SvgText
        x={150}
        y={155}
        fontFamily={fontFamily}
        fontSize={54}
        fontWeight="700"
        fill="#c0001a"
        textAnchor="middle"
      >
        Golf
      </SvgText>

      {/* Push pin — wide oval dome cap */}
      <Ellipse cx={BALL_CX} cy={238} rx={55} ry={36} fill={PIN_GREEN} stroke={PIN_GREEN_DARK} strokeWidth={1} />

      {/* Subtle shadow where the dome meets the neck */}
      <Ellipse cx={BALL_CX} cy={262} rx={44} ry={8} fill="#1a1a1a" opacity={0.18} />

      {/* Upper-left highlight on the dome */}
      <Ellipse cx={133} cy={226} rx={17} ry={12} fill={PIN_GREEN_LIGHT} opacity={0.6} />

      {/* Neck */}
      <Rect x={132} y={262} width={36} height={34} rx={7} ry={7} fill={PIN_GREEN_DARK} />

      {/* Thin dark rect behind the needle for depth */}
      <Rect x={146} y={296} width={8} height={44} fill={NEEDLE_COLOR} opacity={0.35} />

      {/* Needle point */}
      <Polygon points="132,296 168,296 150,340" fill={NEEDLE_COLOR} />
    </Svg>
  );
}
