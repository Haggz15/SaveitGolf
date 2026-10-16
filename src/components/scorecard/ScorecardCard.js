import { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Transparent cutout of the app icon (icon.png has its navy background baked
// in), so only the ball and tee float over the photo.
const LOGO = require('../../../assets/watermark-logo.png');

export function sumPar(holes) {
  return holes.reduce((sum, h) => sum + h.par, 0);
}

export function sumScore(holes) {
  return holes.reduce((sum, h) => sum + h.score, 0);
}

export function computeTotals(scorecard) {
  const isNineHoleRound = !scorecard.back || scorecard.back.length === 0;
  // The owner's Edit Score overrides, when set, replace the hole-by-hole sums.
  const totalPar =
    scorecard.manualPar ?? sumPar(scorecard.front) + (isNineHoleRound ? 0 : sumPar(scorecard.back));
  const totalScore =
    scorecard.manualTotal ?? sumScore(scorecard.front) + (isNineHoleRound ? 0 : sumScore(scorecard.back));
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

// One nine's total, laid out exactly like a holeRow — [label slot the width
// of the hole number | total in a slot the width of a score cell] — so the
// total sits directly under that nine's score column and the label reads
// inline to its left, right-aligned against where the hole numbers end.
// Both texts are wider than their slots, so they get a fixed wider width
// with negative margins that keep the slot's footprint (and so the row's
// centering) identical to the hole rows above.
function NineTotalsItem({ label, total, variant }) {
  const isWide9 = variant === 'wide9';
  return (
    <View style={styles.nineTotalsItem}>
      <View style={styles.nineTotalsItemInner}>
        <View style={isWide9 ? styles.nineTotalsLabelSlotWide9 : styles.nineTotalsLabelSlot}>
          <Text style={[styles.nineTotalsLabel, isWide9 && styles.nineTotalsLabelWide9]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={isWide9 ? styles.nineTotalsScoreSlotWide9 : styles.nineTotalsScoreSlot}>
          <Text style={[styles.nineTotalsScore, isWide9 && styles.nineTotalsScoreWide9]} numberOfLines={1}>
            {total}
          </Text>
        </View>
      </View>
    </View>
  );
}

// Sits directly below the hole-scores row: "FRONT <n>" / "BACK <n>" as two
// flex:1 items with the same gap as ninesRow, so each total lines up under
// its own nine's score column (see NineTotalsItem), each with its own top
// border echoing the hole rows' divider.
// Back is omitted for a 9-hole round. The green "add photo" plus is
// absolutely positioned at the row's right edge, so it doesn't narrow the
// halves and push the totals out of line with the nines above, and always stays
// visible — even once a photo is showing, where it just dims and stops
// doing anything (the remove button in the card's top-right corner handles
// undoing it instead). `hideShareExtras` (set true for the duration of a
// capture) hides it from the exported image since it lives inside the
// captured subtree.
function NineTotalsRow({ frontTotal, backTotal, isNineHoleRound, frontLabel, variant, onAddPhoto, hasPhoto, hideShareExtras }) {
  return (
    <View style={styles.nineTotalsRowWrap}>
      <View style={styles.nineTotalsRow}>
        <NineTotalsItem label={frontLabel} total={frontTotal} variant={variant} />
        {!isNineHoleRound && <NineTotalsItem label="Back" total={backTotal} variant={variant} />}
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

// "SaveitGolf" in Dancing Script, centered beneath the entire card —
// matches the app header's logo exactly (one word, all white), under both
// the with-photo and no-photo layouts.
function TextWatermark({ style }) {
  return (
    <Text style={[styles.textWatermark, style]} numberOfLines={1} pointerEvents="none">
      SaveitGolf
    </Text>
  );
}

// The app icon (photo layouts only) followed by "@username", pinned to the
// bottom-right corner. Only visible while `hideShareExtras` is true (i.e.
// during a share/save capture), so it's baked into the exported image but
// never shows on the live preview. Kept mounted at opacity 0 otherwise so
// the icon has already decoded by the time the capture fires.
function ExportWatermark({ visible, username, showLogo, style }) {
  if (!showLogo && !username) return null;
  return (
    <View style={[styles.exportWatermark, style, !visible && styles.invisible]} pointerEvents="none">
      {showLogo && <Image source={LOGO} style={styles.exportWatermarkLogo} resizeMode="contain" />}
      {username ? (
        <Text style={styles.exportWatermarkUsername} numberOfLines={1}>
          @{username}
        </Text>
      ) : null}
    </View>
  );
}

// Full-width block sat directly below the front/back (or single) nine
// totals row — never floating between or beside the nines.
// `onEditScore`, when passed (owner only), adds a pencil that opens
// EditScoreModal — hidden during a share capture like the other controls.
function TotalBlock({ totalScore, diffLabel, diffTextColor, onEditScore, hideShareExtras }) {
  return (
    <View style={styles.totalBlock}>
      <Text style={styles.totalBlockScore}>{totalScore}</Text>
      <Text style={[styles.totalBlockDiff, { color: diffTextColor }]}> ({diffLabel})</Text>
      {onEditScore && (
        <TouchableOpacity
          onPress={onEditScore}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={[styles.editScoreButton, hideShareExtras && styles.hidden]}
          accessibilityLabel="Edit score"
        >
          <Ionicons name="pencil" size={14} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      )}
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
//   entire card as a background image under a light black overlay (45% at
//   the top where the text sits, 35% at the bottom) so the photo stays
//   vivid behind the scores.
// - 'side' (Option 2): the card splits into a solid-navy left column (52%,
//   all the scores/name content) and a photo-filled right column (48%),
//   sitting flush against it — no border, line or shadow at the seam.
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
  username,
  photoUri,
  photoLayout = 'behind',
  photoPosition,
  onRequestPhoto,
  onRemovePhoto,
  onAddPhoto,
  onEditScore,
  hideShareExtras,
  captureId,
}) {
  // sideLeft's height is the scores column's intrinsic content height —
  // sideRight (the photo) has no content of its own to size against, so on
  // web/html2canvas capture a bare `alignItems: 'stretch'` cross-axis
  // doesn't reliably propagate it. Measuring sideLeft and applying it
  // directly to sideRight guarantees the photo column matches exactly.
  const [scoresHeight, setScoresHeight] = useState(0);

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
        variant={nineVariant}
        onAddPhoto={onAddPhoto}
        hasPhoto={hasPhoto}
        hideShareExtras={hideShareExtras}
      />

      <View style={styles.divider} />
      <TotalBlock
        totalScore={totalScore}
        diffLabel={diffLabel}
        diffTextColor={diffTextColor}
        onEditScore={onEditScore}
        hideShareExtras={hideShareExtras}
      />
    </View>
  );

  return (
    <View nativeID={captureId} style={styles.cardOuter}>
      {isSideLayout ? (
        <View style={styles.sideRow}>
          <View style={styles.sideLeft} onLayout={(e) => setScoresHeight(e.nativeEvent.layout.height)}>
            {cardBody}
          </View>
          <PhotoWrapper
            style={[styles.sideRight, scoresHeight > 0 ? { height: scoresHeight } : null]}
            onPress={onRequestPhoto}
            activeOpacity={onRequestPhoto ? 0.9 : 1}
          >
            <Image
              source={{ uri: photoUri }}
              style={[styles.sidePhotoImage, photoPositionStyle]}
              resizeMode="cover"
            />
            {onRemovePhoto && (
              <RemovePhotoButton onPress={onRemovePhoto} hideShareExtras={hideShareExtras} style={styles.sideRemoveButton} />
            )}
            <ExportWatermark
              visible={hideShareExtras}
              username={username}
              showLogo
              style={styles.sideExportWatermark}
            />
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
              colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.4)']}
              locations={[0, 1]}
              style={styles.photoGradient}
              pointerEvents="none"
            />
          )}

          {cardBody}

          {hasPhoto && onRemovePhoto && (
            <RemovePhotoButton onPress={onRemovePhoto} hideShareExtras={hideShareExtras} />
          )}

          <ExportWatermark visible={hideShareExtras} username={username} showLogo={hasPhoto} />
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
  // 40% black at the top (behind the name/scores) easing to 30% at the
  // bottom — enough for the text to read without hiding the photo.
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
  // content, photo-filled right column (48%) flush against it.
  // Row height is driven by sideLeft's intrinsic content height — sideRight
  // stretches (default alignItems) to match it.
  sideRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  // alignSelf: 'flex-start' opts out of sideRow's stretch so onLayout reports
  // the score content's intrinsic height, not a height inflated by the photo.
  sideLeft: {
    width: '52%',
    backgroundColor: colors.navy,
    alignSelf: 'flex-start',
  },
  // No border, line or shadow at the seam — the photo meets the navy
  // column directly and the content difference alone separates them.
  sideRight: {
    width: '48%',
    position: 'relative',
    overflow: 'hidden',
  },
  // Absolute so the photo's intrinsic size never contributes to the row's
  // height — sideRight is sized only by the measured scores height.
  sidePhotoImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Overrides removePhotoButton's top-right corner pin to instead sit on
  // the seam, vertically centered.
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
  // nested per-column. Mirrors ninesRow's full width and 12px gap so each
  // flex:1 half sits exactly under its nine. Wrapped in nineTotalsRowWrap
  // so the add-photo plus can be pinned to the right edge out of the flow.
  nineTotalsRowWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  nineTotalsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoPlusButton: {
    position: 'absolute',
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.brightGreen,
    alignItems: 'center',
    justifyContent: 'center',
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
  invisible: {
    opacity: 0,
  },
  // One nine's total cell, with its own top border echoing the divider
  // above the hole rows. The inner row mirrors holeRow (centered, gap 3,
  // slots sized to holeNumber/scoreCell) so the total lands under the
  // score column.
  nineTotalsItem: {
    flex: 1,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingTop: 3,
    marginTop: 3,
  },
  nineTotalsItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  // Label slot = holeNumber width (14 / 18); the label itself is wider and
  // overflows leftward via a negative marginLeft, right-aligned.
  nineTotalsLabelSlot: {
    width: 14,
    alignItems: 'flex-end',
  },
  nineTotalsLabelSlotWide9: {
    width: 18,
    alignItems: 'flex-end',
  },
  nineTotalsLabel: {
    width: 50,
    marginLeft: -36,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  nineTotalsLabelWide9: {
    width: 56,
    marginLeft: -38,
    fontSize: 11,
  },
  // Score slot = scoreCell width (20 / 28); the two-digit total gets a
  // wider centered box with negative side margins so it stays centered on
  // the score column without changing the slot's footprint.
  nineTotalsScoreSlot: {
    width: 20,
    alignItems: 'center',
  },
  nineTotalsScoreSlotWide9: {
    width: 28,
    alignItems: 'center',
  },
  nineTotalsScore: {
    width: 36,
    marginHorizontal: -8,
    textAlign: 'center',
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  nineTotalsScoreWide9: {
    width: 44,
    marginHorizontal: -8,
    fontSize: 20,
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
    fontSize: 44,
    fontWeight: '800',
    color: colors.white,
  },
  totalBlockDiff: {
    fontSize: 14,
    fontWeight: '700',
  },
  // Pinned to the right edge so the score stays centered.
  editScoreButton: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  // "SaveitGolf" text watermark, centered below the entire card — same
  // font and solid white as the app header's logo.
  textWatermark: {
    width: '100%',
    fontFamily: 'DancingScript_700Bold',
    fontSize: 18,
    color: colors.white,
    textAlign: 'center',
    paddingVertical: 10,
  },
  // Behind / no-photo layouts: pinned to the card's bottom-right, level with
  // the centered "SaveitGolf" text. maxWidth keeps a long username clear of it.
  exportWatermark: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    maxWidth: '38%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  // Side layout: sits in the photo column's own bottom-right corner.
  sideExportWatermark: {
    bottom: 6,
    right: 6,
    maxWidth: '90%',
  },
  exportWatermarkLogo: {
    width: 28,
    height: 28,
  },
  exportWatermarkUsername: {
    flexShrink: 1,
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
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
