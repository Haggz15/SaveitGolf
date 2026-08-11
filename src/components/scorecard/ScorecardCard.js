import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import GolfBallMark, { useGolfBallFont } from '../common/GolfBallMark';

const PHOTO_WATERMARK_WIDTH = 34;

export function sumPar(holes) {
  return holes.reduce((sum, h) => sum + h.par, 0);
}

export function sumScore(holes) {
  return holes.reduce((sum, h) => sum + h.score, 0);
}

export function computeTotals(scorecard) {
  const isNineHoleRound = !scorecard.back || scorecard.back.length === 0;
  const totalPar = sumPar(scorecard.front) + (isNineHoleRound ? 0 : sumPar(scorecard.back));
  const totalScore = sumScore(scorecard.front) + (isNineHoleRound ? 0 : sumScore(scorecard.back));
  const diff = totalScore - totalPar;
  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  return { isNineHoleRound, totalPar, totalScore, diff, diffLabel };
}

// Only used for the "(+3)"/"(-2)"/"(E)" label next to the total — the total
// score digits themselves always stay white (see ScorecardCard below).
function diffColor(diff) {
  if (diff > 0) return colors.red;
  if (diff < 0) return colors.brightGreen;
  return '#4a9eff';
}

// "Blue" / "Ridge" / "Blue Nine" typed verbatim by the user — shown exactly
// as entered, never suffixed with "Nine"/"9". 18-hole rounds with both a
// front and back name join them with " / "; either half may be omitted.
function compositeNameFor(scorecard, isNineHoleRound) {
  const front = (scorecard.compositeFront || '').trim();
  const back = (scorecard.compositeBack || '').trim();
  if (isNineHoleRound) return front || null;
  if (front && back) return `${front} / ${back}`;
  return front || back || null;
}

function splitNameWords(fullName) {
  return (fullName || '').trim().split(/\s+/).filter(Boolean);
}

// "OWEN HAGGERTY" -> O and H rendered larger (18px) than the rest of their
// words (12px). A single-word name collapses first-word/last-word onto the
// same letter.
function StyledPlayerName({ fullName }) {
  const words = splitNameWords(fullName);
  return (
    <Text style={styles.nameLine} numberOfLines={1}>
      {words.map((word, wi) => {
        const isEdgeWord = wi === 0 || wi === words.length - 1;
        const firstChar = word.slice(0, 1);
        const rest = word.slice(1);
        return (
          <Text key={wi}>
            {firstChar ? <Text style={isEdgeWord ? styles.nameBig : styles.nameSmall}>{firstChar}</Text> : null}
            {rest ? <Text style={styles.nameSmall}>{rest}</Text> : null}
            {wi < words.length - 1 ? <Text style={styles.nameSmall}> </Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}

// Birdie/eagle: green circle border. Bogey/double bogey: red square border.
// Par: plain white number, no shape. `variant` scales the cell/digit up for
// the full-width no-photo layouts, which have room to spare (Fix 4).
function ScoreCell({ score, par, variant }) {
  const diff = score - par;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const color = isUnder ? colors.brightGreen : isOver ? colors.red : colors.white;
  const cellStyle = variant === 'wide9' ? styles.scoreCellWide9 : variant === 'wide18' ? styles.scoreCellWide18 : styles.scoreCell;
  const digitStyle = variant === 'wide9' ? styles.scoreDigitWide9 : variant === 'wide18' ? styles.scoreDigitWide18 : styles.scoreDigit;

  return (
    <View
      style={[
        cellStyle,
        isUnder && styles.scoreCellCircle,
        isOver && styles.scoreCellSquare,
        (isUnder || isOver) && { borderColor: color },
      ]}
    >
      <Text style={[digitStyle, { color }]}>{score}</Text>
    </View>
  );
}

// One nine's hole rows only — [hole number, right-aligned | score cell].
// `variant` is 'compact' (default, alongside a photo), 'wide18' (full-width,
// 18 holes — front/back centered in their own half) or 'wide9' (full-width,
// 9 holes — single centered column with bigger type since there's more
// room). The front/back totals live in the separate NineTotalsRow below,
// not nested in here.
function NineColumn({ holes, variant = 'compact' }) {
  const isWide = variant !== 'compact';
  return (
    <View style={styles.nineColumn}>
      {holes.map((h) => (
        <View key={h.hole} style={[styles.holeRow, isWide && styles.holeRowWide]}>
          <Text style={[styles.holeNumber, variant === 'wide9' && styles.holeNumberWide9]}>{h.hole}</Text>
          <ScoreCell score={h.score} par={h.par} variant={variant} />
        </View>
      ))}
    </View>
  );
}

// Sits directly below the hole-scores row: "Front <n>" / "Back <n>" as two
// flex:1 items spread across the full width of the scores column, each with
// a small label + bold score. Back is omitted for a 9-hole round.
function NineTotalsRow({ frontTotal, backTotal, isNineHoleRound }) {
  return (
    <View style={styles.nineTotalsRow}>
      <View style={styles.nineTotalsItem}>
        <Text style={styles.nineTotalsLabel}>Front</Text>
        <Text style={styles.nineTotalsScore}>{frontTotal}</Text>
      </View>
      {!isNineHoleRound && (
        <View style={styles.nineTotalsItem}>
          <Text style={styles.nineTotalsLabel}>Back</Text>
          <Text style={styles.nineTotalsScore}>{backTotal}</Text>
        </View>
      )}
    </View>
  );
}

// The real SaveitGolf mark (ball + wordmark + pin, see GolfBallMark), scaled
// down to 34px wide and faded to read as a subtle watermark rather than a
// logo — used over the photo only (Fix 2); the scores side gets a plain text
// watermark instead (see TextWatermark below).
function WatermarkLogo({ fontFamily, style }) {
  return (
    <View style={[styles.watermarkLogo, style]} pointerEvents="none">
      <GolfBallMark fontFamily={fontFamily} displayWidth={PHOTO_WATERMARK_WIDTH} />
    </View>
  );
}

// "Save it Golf" in Dancing Script, right-aligned — sits under the scores in
// both the with-photo and no-photo layouts (Fix 2). Deliberately just text,
// no ball art, so it stays legible at 11px without crowding the totals.
function TextWatermark({ style }) {
  return (
    <Text style={[styles.textWatermark, style]} numberOfLines={1} pointerEvents="none">
      Save it<Text style={styles.textWatermarkGolf}> Golf</Text>
    </Text>
  );
}

// Full-width block sat directly below the front/back (or single) nine
// totals row — never floating between or beside the nines (Fix 3). Same
// fixed sizing for both the with-photo and no-photo layouts; it's always a
// child of `scoresColumn`, so it naturally spans that column's width only
// (with-photo) or the full card width (no-photo, where scoresColumn itself
// expands — see `scoresColumnFullWidth`).
function TotalBlock({ totalScore, diffLabel, diffTextColor }) {
  return (
    <View style={styles.totalBlock}>
      <Text style={styles.totalBlockScore}>{totalScore}</Text>
      <Text style={[styles.totalBlockDiff, { color: diffTextColor }]}> ({diffLabel})</Text>
    </View>
  );
}

// Full-height photo column, only ever rendered when a photo exists (see
// `hasPhoto` below — the no-photo state renders full-width scores plus an
// "Add Photo" button instead). Fills the column, gets the ball-mark
// watermark in its bottom-right corner, and (when `onRemovePhoto` is passed)
// a red "Remove" pill top-right to clear it back to the no-photo layout.
function PhotoColumn({ photoUri, onRequestPhoto, onRemovePhoto, fontFamily }) {
  const Wrapper = onRequestPhoto ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.photoColumn}
      onPress={onRequestPhoto}
      activeOpacity={onRequestPhoto ? 0.85 : 1}
    >
      <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
      <WatermarkLogo fontFamily={fontFamily} style={styles.photoWatermarkCorner} />
      {onRemovePhoto && (
        <TouchableOpacity
          onPress={onRemovePhoto}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.removePhotoButton}
        >
          <Text style={styles.removePhotoButtonText}>✕ Remove</Text>
        </TouchableOpacity>
      )}
    </Wrapper>
  );
}

// Scores (left 48%) + photo (right 52%), side by side, when there's a
// photo. With no photo the scores column expands to the full card width
// instead — front/back nines centered side by side for 18 holes, or a
// single bigger centered column for 9 (Fix 1/4). `onRequestPhoto` is only
// passed by the live "new scorecard" view (it re-opens the picker when the
// existing photo is tapped) — past scorecards fetched from Supabase render
// read-only. The "Add Photo" action itself lives outside this component, as
// a button overlaid on the card by ScorecardScreen, so it's never part of
// the captured share image. `captureId`, when passed, becomes a real DOM
// `id` on web (see ScorecardScreen's handleShare) so the share capture can
// target this exact element — no photo column means no extra space on the
// right, and with a photo the column already sits flush with the card's own
// right edge (see cardBodyWithPhoto), so capturing this node directly needs
// no cropping. Left undefined by every other caller (e.g.
// ScorecardDetailModal) so two instances never collide on the same id when
// both happen to be mounted at once (the detail modal open over the main
// screen).
export default function ScorecardCard({ scorecard, fullName, photoUri, onRequestPhoto, onRemovePhoto, captureId }) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);
  const diffTextColor = diffColor(diff);
  const compositeName = compositeNameFor(scorecard, isNineHoleRound);
  const hasPhoto = Boolean(photoUri);
  const nineVariant = hasPhoto ? 'compact' : isNineHoleRound ? 'wide9' : 'wide18';
  const ballFont = useGolfBallFont();
  const frontTotal = sumScore(scorecard.front);
  const backTotal = isNineHoleRound ? null : sumScore(scorecard.back);

  return (
    <View nativeID={captureId} style={[styles.cardBody, hasPhoto && styles.cardBodyWithPhoto]}>
      <View style={[styles.scoresColumn, !hasPhoto && styles.scoresColumnFullWidth]}>
        <StyledPlayerName fullName={fullName} />
        <Text style={styles.courseNameText} numberOfLines={2}>
          {scorecard.courseName}
        </Text>
        {compositeName ? (
          <Text style={styles.compositeNameText} numberOfLines={1}>
            {compositeName}
          </Text>
        ) : null}
        <View style={styles.divider} />

        <View style={styles.ninesRow}>
          <NineColumn holes={scorecard.front} variant={nineVariant} />
          {!isNineHoleRound && <NineColumn holes={scorecard.back} variant={nineVariant} />}
        </View>

        <View style={styles.divider} />
        <NineTotalsRow frontTotal={frontTotal} backTotal={backTotal} isNineHoleRound={isNineHoleRound} />

        <View style={styles.divider} />
        <TotalBlock totalScore={totalScore} diffLabel={diffLabel} diffTextColor={diffTextColor} />

        <TextWatermark style={styles.cardWatermarkPosition} />
      </View>

      {hasPhoto && (
        <PhotoColumn
          photoUri={photoUri}
          onRequestPhoto={onRequestPhoto}
          onRemovePhoto={onRemovePhoto}
          fontFamily={ballFont}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 14,
    backgroundColor: colors.navy,
    // This is the root of the ViewShot-captured subtree (Fix 3) — clip and
    // round it to match the on-screen card exactly, so the exported image
    // never bleeds past the intended edge.
    borderRadius: 16,
    overflow: 'hidden',
  },
  // With a photo, the photo column must reach the card's right edge with
  // nothing beyond it (Fix 3) — the no-photo layout keeps its right padding.
  cardBodyWithPhoto: {
    paddingRight: 0,
  },
  scoresColumn: {
    flexGrow: 48,
    flexBasis: 0,
    // Reserves room for the absolutely-positioned corner watermark so it
    // never overlaps the nines' own bottom content.
    paddingBottom: 44,
  },
  scoresColumnFullWidth: {
    flexGrow: 1,
    width: '100%',
  },
  // Name
  nameLine: {
    textTransform: 'uppercase',
  },
  nameBig: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 18,
    color: colors.white,
    letterSpacing: 18 * 0.05,
    textTransform: 'uppercase',
  },
  nameSmall: {
    fontFamily: 'Oswald_700Bold',
    fontSize: 12,
    color: colors.white,
    letterSpacing: 12 * 0.05,
    textTransform: 'uppercase',
  },
  courseNameText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 9,
    color: colors.lightBlue,
    marginTop: 5,
  },
  compositeNameText: {
    fontFamily: 'Cinzel_700Bold',
    fontStyle: 'italic',
    fontSize: 7.5,
    color: '#6a8ab0',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.navyBorder,
    marginTop: 8,
    marginBottom: 8,
  },
  // Nines
  ninesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nineColumn: {
    flex: 1,
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 1,
  },
  // Full-width no-photo layouts (Fix 4): hole number + score cell centered
  // within their column instead of hugging the left edge.
  holeRowWide: {
    justifyContent: 'center',
  },
  holeNumber: {
    width: 14,
    textAlign: 'right',
    color: colors.muted,
    fontSize: 8,
  },
  holeNumberWide9: {
    width: 18,
    fontSize: 11,
    color: colors.muted,
  },
  scoreCell: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCellWide18: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCellWide9: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDigit: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreDigitWide18: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreDigitWide9: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreCellCircle: {
    borderWidth: 1,
    borderRadius: 8,
  },
  scoreCellSquare: {
    borderWidth: 1,
    borderRadius: 2,
  },
  // Front/back totals row (Fix 5) — one shared row below the hole scores,
  // not nested per-column, so both items line up on flex:1 and spread
  // across the full width of the scores column.
  nineTotalsRow: {
    flexDirection: 'row',
  },
  nineTotalsItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  nineTotalsLabel: {
    color: '#6a8ab0',
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nineTotalsScore: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  // Grand total block (Fix 3/5): sits directly below the front/back (or
  // single) nine totals row, spanning the full width of `scoresColumn` —
  // which is either the card's whole width (no photo) or just the scores
  // side (with photo) — never floating between or beside the nines.
  totalBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  totalBlockScore: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
  },
  totalBlockDiff: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Bottom-right ball mark watermark (Fix 2) — only ever used over the photo
  // now; the scores side gets the text watermark below instead.
  watermarkLogo: {
    opacity: 0.45,
  },
  // "Save it Golf" text watermark under the scores (Fix 2) — used in both
  // the with-photo and no-photo layouts.
  textWatermark: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 11,
    color: colors.white,
    opacity: 0.5,
    textAlign: 'right',
  },
  textWatermarkGolf: {
    color: colors.red,
  },
  cardWatermarkPosition: {
    position: 'absolute',
    bottom: 0,
    right: 0,
  },
  // Photo column
  photoColumn: {
    flexGrow: 52,
    flexBasis: 0,
    // Only the left edge rounds — the right edge is flush with the card's
    // own edge, whose corners are already rounded by cardBody (Fix 3), so
    // this doesn't leave a mismatched double-rounded seam there.
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  // Ball-mark watermark over the photo (Fix 2) — bottom-right corner, no
  // pill background and no text beside it.
  photoWatermarkCorner: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    opacity: 0.72,
  },
  removePhotoButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(192, 0, 26, 0.85)',
    borderRadius: 5,
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  removePhotoButtonText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
