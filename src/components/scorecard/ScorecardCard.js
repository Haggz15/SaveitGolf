import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../../theme/colors';

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

// Base (unscaled) sizes for the big first-letters / small-rest-of-word name
// styling — see nameFontScale below for how these shrink to keep the name
// on one line.
const NAME_BIG_BASE = 22;
const NAME_SMALL_BASE = 14;
const NAME_MIN_SCALE = 0.5;
// The card is always full width now (Option 3 — photo is a full-bleed
// background, not a side column narrowing the text), so a name fits
// comfortably up to this many characters before it needs to scale down.
const NAME_COMFORTABLE_LENGTH = 17;

// react-native-web has no adjustsFontSizeToFit, and this card is captured
// as a share image on both native and web, so the name can't rely on
// platform auto-shrink — it has to be sized up front from the text itself.
function nameFontScale(fullName) {
  const length = (fullName || '').trim().length;
  if (length <= NAME_COMFORTABLE_LENGTH) return 1;
  return Math.max(NAME_MIN_SCALE, NAME_COMFORTABLE_LENGTH / length);
}

// "OWEN HAGGERTY" -> O and H rendered larger than the rest of their words.
// A single-word name collapses first-word/last-word onto the same letter.
function StyledPlayerName({ fullName }) {
  const words = splitNameWords(fullName);
  const scale = nameFontScale(fullName);
  const bigStyle = [
    styles.nameBig,
    scale !== 1 && { fontSize: NAME_BIG_BASE * scale, letterSpacing: NAME_BIG_BASE * scale * 0.05 },
  ];
  const smallStyle = [
    styles.nameSmall,
    scale !== 1 && { fontSize: NAME_SMALL_BASE * scale, letterSpacing: NAME_SMALL_BASE * scale * 0.05 },
  ];
  return (
    <Text style={styles.nameLine} numberOfLines={1}>
      {words.map((word, wi) => {
        const isEdgeWord = wi === 0 || wi === words.length - 1;
        const firstChar = word.slice(0, 1);
        const rest = word.slice(1);
        return (
          <Text key={wi}>
            {firstChar ? <Text style={isEdgeWord ? bigStyle : smallStyle}>{firstChar}</Text> : null}
            {rest ? <Text style={smallStyle}>{rest}</Text> : null}
            {wi < words.length - 1 ? <Text style={smallStyle}> </Text> : null}
          </Text>
        );
      })}
    </Text>
  );
}

// Birdie/eagle: green circle border. Bogey/double bogey: red square border.
// Par: plain white number, no shape. The card is always full width now
// (Option 3), so cells always use the larger "wide" sizing — `variant`
// just picks which of the two wide sizes (9-hole rounds get the bigger one,
// since a single nine has more room to spare than a front+back pair).
function ScoreCell({ score, par, variant }) {
  const diff = score - par;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const color = isUnder ? colors.brightGreen : isOver ? colors.red : colors.white;
  const cellStyle = variant === 'wide9' ? styles.scoreCellWide9 : styles.scoreCellWide18;
  const digitStyle = variant === 'wide9' ? styles.scoreDigitWide9 : styles.scoreDigitWide18;

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

// One nine's hole rows only — [hole number, right-aligned | score cell],
// centered within its half of the scores row. `variant` is 'wide18' (18
// holes — front/back centered side by side) or 'wide9' (9 holes — single
// centered column with bigger type since there's more room). The front/back
// totals live in the separate NineTotalsRow below, not nested in here.
// `holeNumberOffset` shifts the displayed hole numbers (e.g. +9 so a
// back-nine round reads 10-18) without touching the underlying holes data.
function NineColumn({ holes, variant, holeNumberOffset = 0 }) {
  return (
    <View style={styles.nineColumn}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.holeRow}>
          <Text style={[styles.holeNumber, variant === 'wide9' && styles.holeNumberWide9]}>
            {h.hole + holeNumberOffset}
          </Text>
          <ScoreCell score={h.score} par={h.par} variant={variant} />
        </View>
      ))}
    </View>
  );
}

// Sits directly below the hole-scores row: "Front <n>" / "Back <n>" as two
// flex:1 items spread across the full width of the card, centered within
// their half, each with its own top border echoing the hole rows' divider.
// Back is omitted for a 9-hole round. The green "add photo" plus sits to
// the right of this row, outside the flex:1 spread, and always stays
// visible — even once a photo is showing, where it just dims and stops
// doing anything (the remove button in the card's top-right corner handles
// undoing it instead). `hideShareExtras` (set true for the duration of a
// capture) hides it from the exported image since it lives inside the
// captured subtree.
function NineTotalsRow({ frontTotal, backTotal, isNineHoleRound, frontLabel, onAddPhoto, hasPhoto, hideShareExtras }) {
  return (
    <View style={styles.nineTotalsRowWrap}>
      <View style={styles.nineTotalsRow}>
        <View style={styles.nineTotalsItem}>
          <View style={styles.nineTotalsSpacer} />
          <Text style={styles.nineTotalsLabel}>{frontLabel}</Text>
          <Text style={styles.nineTotalsScore}>{frontTotal}</Text>
        </View>
        {!isNineHoleRound && (
          <View style={styles.nineTotalsItem}>
            <View style={styles.nineTotalsSpacer} />
            <Text style={styles.nineTotalsLabel}>Back</Text>
            <Text style={styles.nineTotalsScore}>{backTotal}</Text>
          </View>
        )}
      </View>
      {onAddPhoto && (
        <TouchableOpacity
          onPress={hasPhoto ? null : onAddPhoto}
          disabled={hasPhoto}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.addPhotoPlusButton,
            hasPhoto && styles.addPhotoPlusButtonDimmed,
            hideShareExtras && styles.hidden,
          ]}
          activeOpacity={hasPhoto ? 1 : 0.85}
        >
          <Text style={styles.addPhotoPlusButtonText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// "Save it Golf" in Dancing Script, centered beneath the entire card — no
// ball art (the golf-ball watermark has been removed entirely), so it stays
// a plain, legible text mark under both the with-photo and no-photo layouts.
function TextWatermark({ style }) {
  return (
    <Text style={[styles.textWatermark, style]} numberOfLines={1} pointerEvents="none">
      Save it<Text style={styles.textWatermarkGolf}> Golf</Text>
    </Text>
  );
}

// Full-width block sat directly below the front/back (or single) nine
// totals row — never floating between or beside the nines.
function TotalBlock({ totalScore, diffLabel, diffTextColor }) {
  return (
    <View style={styles.totalBlock}>
      <Text style={styles.totalBlockScore}>{totalScore}</Text>
      <Text style={[styles.totalBlockDiff, { color: diffTextColor }]}> ({diffLabel})</Text>
    </View>
  );
}

// Small circular button pinned to the card's top-right corner, shown only
// once a photo is filling the card's background. Tapping it removes the
// photo and reverts to the plain navy card. Hidden during a share capture
// via `hideShareExtras` since it's an interactive control, not part of the
// exported image.
function RemovePhotoButton({ onPress, hideShareExtras, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.removePhotoButton, style, hideShareExtras && styles.hidden]}
    >
      <Text style={styles.removePhotoButtonText}>‹</Text>
    </TouchableOpacity>
  );
}

// Two photo layouts, picked by the "Side"/"Behind" toggle (Fix 2) and
// persisted per-scorecard as `photoLayout` (Fix 5):
//
// - 'behind' (Option 3, the original/default layout): the photo fills the
//   entire card as a background image with a dark gradient overlay behind
//   the scores (heavy at the top where the text sits, fading out toward the
//   bottom so the photo peeks through below the total block).
// - 'side' (Option 2): the card splits into a solid-navy left column (52%,
//   all the scores/name content) and a photo-filled right column (48%),
//   blended at the seam with a navy-to-transparent gradient over the
//   photo's left edge.
//
// With no photo the card is just its usual solid navy regardless of
// `photoLayout`. `onRequestPhoto` re-opens the picker when the visible
// photo itself is tapped, and is only passed by the live "new scorecard"
// view — past scorecards fetched from Supabase render read-only unless
// `onAddPhoto` is passed too (see ScorecardDetailModal, owner-only).
// `onAddPhoto`, when passed, renders the green plus beside the front/back
// totals row — it stays visible even once a photo is showing, just dimmed
// and inert, since `onRemovePhoto` (via the remove button) is what undoes
// it. `hideShareExtras` hides both the plus and the remove button for the
// duration of a capture, since they live inside the captured subtree.
// `captureId`, when passed, becomes a real DOM `id` on web (see
// ScorecardScreen's handleShare) so the share capture can target this exact
// element — its outer boundary spans the full card either way, so a single
// capture of it already crops to the photo's right edge in 'side' layout
// and to the full card width in 'behind' layout (Fix 6).
export default function ScorecardCard({
  scorecard,
  fullName,
  photoUri,
  photoLayout = 'behind',
  photoPosition,
  onRequestPhoto,
  onRemovePhoto,
  onAddPhoto,
  hideShareExtras,
  captureId,
}) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);
  // Web has no native OS crop step (see WebPhotoCropModal) — instead of a
  // true pixel crop, the picker there hands back which part of the photo to
  // center the `cover`-resized frame on. Native bakes its crop into the
  // picked file itself, so photoPosition is never set there and the image
  // just keeps its default centered objectPosition.
  const photoPositionStyle =
    Platform.OS === 'web' && photoPosition ? { objectPosition: `${photoPosition.x}% ${photoPosition.y}%` } : null;
  const diffTextColor = diffColor(diff);
  const compositeName = compositeNameFor(scorecard, isNineHoleRound);
  const hasPhoto = Boolean(photoUri);
  const isSideLayout = hasPhoto && photoLayout === 'side';
  const nineVariant = isNineHoleRound ? 'wide9' : 'wide18';
  const frontTotal = sumScore(scorecard.front);
  const backTotal = isNineHoleRound ? null : sumScore(scorecard.back);
  // A 9-hole round can be played on either nine (Fix 2) — offsets the
  // displayed hole numbers and swaps the single total's label to "Back"
  // without touching the underlying holes data, which always stays 1-9.
  const isBackNine = isNineHoleRound && scorecard.nineSide === 'back';
  const holeNumberOffset = isBackNine ? 9 : 0;
  const frontLabel = isBackNine ? 'Back' : 'Front';

  const PhotoWrapper = onRequestPhoto ? TouchableOpacity : View;

  const cardBody = (
    <View style={styles.cardBody}>
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
        <NineColumn holes={scorecard.front} variant={nineVariant} holeNumberOffset={holeNumberOffset} />
        {!isNineHoleRound && <NineColumn holes={scorecard.back} variant={nineVariant} />}
      </View>

      <NineTotalsRow
        frontTotal={frontTotal}
        backTotal={backTotal}
        isNineHoleRound={isNineHoleRound}
        frontLabel={frontLabel}
        onAddPhoto={onAddPhoto}
        hasPhoto={hasPhoto}
        hideShareExtras={hideShareExtras}
      />

      <View style={styles.divider} />
      <TotalBlock totalScore={totalScore} diffLabel={diffLabel} diffTextColor={diffTextColor} />
    </View>
  );

  return (
    <View nativeID={captureId} style={styles.cardOuter}>
      {isSideLayout ? (
        <View style={styles.sideRow}>
          <View style={styles.sideLeft}>{cardBody}</View>
          <PhotoWrapper
            style={styles.sideRight}
            onPress={onRequestPhoto}
            activeOpacity={onRequestPhoto ? 0.9 : 1}
          >
            <Image
              source={{ uri: photoUri }}
              style={[styles.sidePhotoImage, photoPositionStyle]}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['#0d1f3c', 'rgba(13,31,60,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sidePhotoFade}
              pointerEvents="none"
            />
            {onRemovePhoto && (
              <RemovePhotoButton onPress={onRemovePhoto} hideShareExtras={hideShareExtras} style={styles.sideRemoveButton} />
            )}
          </PhotoWrapper>
        </View>
      ) : (
        <>
          {hasPhoto && (
            <PhotoWrapper
              style={styles.photoBackground}
              onPress={onRequestPhoto}
              activeOpacity={onRequestPhoto ? 0.9 : 1}
            >
              <Image
                source={{ uri: photoUri }}
                style={[styles.photoImage, photoPositionStyle]}
                resizeMode="cover"
              />
            </PhotoWrapper>
          )}

          {hasPhoto && (
            <LinearGradient
              colors={['rgba(13,31,60,0.97)', 'rgba(13,31,60,0.92)', 'rgba(13,31,60,0.5)', 'rgba(13,31,60,0.15)']}
              locations={[0, 0.5, 0.75, 1]}
              style={styles.photoGradient}
              pointerEvents="none"
            />
          )}

          {cardBody}

          {hasPhoto && onRemovePhoto && (
            <RemovePhotoButton onPress={onRemovePhoto} hideShareExtras={hideShareExtras} />
          )}
        </>
      )}

      <TextWatermark />
    </View>
  );
}

const styles = StyleSheet.create({
  // This is the root of the ViewShot/html2canvas-captured subtree — clip and
  // round it to match the on-screen card exactly (so the exported image
  // never bleeds past the intended edge), and the positioning context for
  // the full-bleed photo background/gradient and the top-right remove
  // button.
  cardOuter: {
    backgroundColor: colors.navy,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  // Fills the entire card behind everything else (Option 3) — the gradient
  // and content simply paint on top of it in document order, no zIndex
  // needed.
  photoBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  // Heavy at the top (behind the name/scores) fading to nearly transparent
  // at the bottom, so the photo peeks through below the total block.
  photoGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardBody: {
    padding: 14,
    // Extra headroom above the larger Barlow Condensed player name so its
    // big first letters (22px) don't feel cramped against the card's top
    // edge.
    paddingTop: 14 + 12,
  },
  // Side layout (Option 2): solid-navy left column (52%) with the score
  // content, photo-filled right column (48%) blended at the seam via
  // sidePhotoFade. Row height is driven by sideLeft's intrinsic content
  // height — sideRight stretches (default alignItems) to match it.
  sideRow: {
    flexDirection: 'row',
  },
  sideLeft: {
    width: '52%',
    backgroundColor: colors.navy,
  },
  sideRight: {
    width: '48%',
    position: 'relative',
    overflow: 'hidden',
  },
  sidePhotoImage: {
    width: '100%',
    height: '100%',
  },
  // Navy-to-transparent, left to right, over the photo's left edge so it
  // blends into the solid-navy left column rather than showing a hard seam.
  sidePhotoFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: '55%',
  },
  // Overrides removePhotoButton's top-right corner pin to instead sit on
  // the fade seam, vertically centered.
  sideRemoveButton: {
    top: '50%',
    right: undefined,
    left: -13,
    marginTop: -13,
  },
  // Name
  nameLine: {
    textTransform: 'uppercase',
  },
  nameBig: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 22,
    color: colors.white,
    letterSpacing: 22 * 0.05,
    textTransform: 'uppercase',
  },
  nameSmall: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 14,
    color: colors.white,
    letterSpacing: 14 * 0.05,
    textTransform: 'uppercase',
  },
  courseNameText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 12,
    color: colors.lightBlue,
    marginTop: 5,
  },
  compositeNameText: {
    fontFamily: 'Cinzel_700Bold',
    fontStyle: 'italic',
    fontSize: 10,
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
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 1,
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
  // Front/back totals row — one shared row below the hole scores, not
  // nested per-column, so both items line up on flex:1 and spread across
  // the full width of the card. Wrapped in nineTotalsRowWrap so the
  // add-photo plus can sit to its right as a fixed-width sibling outside
  // the flex:1 spread.
  nineTotalsRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  nineTotalsRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  addPhotoPlusButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brightGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  // Once a photo is showing the plus stops doing anything — the top-right
  // remove button undoes it instead — so it dims to read as inert rather
  // than disappearing.
  addPhotoPlusButtonDimmed: {
    backgroundColor: 'rgba(77,216,96,0.4)',
  },
  addPhotoPlusButtonText: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 19,
  },
  // Hides the plus/remove button from a share capture without unmounting
  // them, so no layout jump happens when they reappear right after.
  hidden: {
    display: 'none',
  },
  // Each item gets a 13px leading spacer — matching the hole-number
  // column's width — so its score digit lands directly under the hole
  // scores above, plus its own top border echoing the divider above the
  // hole rows, centered under the centered hole scores above it.
  nineTotalsItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingTop: 3,
    marginTop: 3,
  },
  nineTotalsSpacer: {
    width: 13,
  },
  nineTotalsLabel: {
    color: '#6a8ab0',
    fontSize: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nineTotalsScore: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  // Grand total block: sits directly below the front/back (or single) nine
  // totals row, spanning the full card width — never floating between or
  // beside the nines.
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
  // "Save it Golf" text watermark, centered below the entire card. Sits
  // over the lightest part of the gradient when a photo is present (the
  // photo "peeks through" here per the Option 3 design), so it keeps its
  // own opacity rather than needing extra contrast treatment.
  textWatermark: {
    width: '100%',
    fontFamily: 'DancingScript_700Bold',
    fontWeight: '700',
    fontSize: 18,
    color: colors.white,
    opacity: 0.6,
    textAlign: 'center',
    paddingVertical: 10,
  },
  textWatermarkGolf: {
    color: colors.red,
  },
  // Pinned to the card's top-right corner, only shown once a photo is
  // filling the background.
  removePhotoButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(13,31,60,0.9)',
    borderRadius: 13,
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  removePhotoButtonText: {
    color: colors.white,
    fontSize: 16,
  },
});
