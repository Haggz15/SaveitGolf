import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
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
// a 13px leading spacer (matching the hole-number column width) so the
// score digits line up under the scores directly above, plus its own
// top border echoing the hole rows' divider. Back is omitted for a 9-hole
// round. The green "add photo" plus (Fix 2) sits to the right of this row,
// outside the flex:1 spread, and always stays visible — even once a photo
// is showing, where it just dims and stops doing anything (the revert
// arrow on the photo column handles undoing it instead). `hideShareExtras`
// (set true for the duration of a capture) hides it from the exported
// image since, unlike the old top-right overlay, this button lives inside
// the captured subtree.
function NineTotalsRow({ frontTotal, backTotal, isNineHoleRound, onAddPhoto, columnVisible, hideShareExtras }) {
  // The no-photo layout centers each hole row within its half (holeRowWide),
  // while the with-photo layout keeps hole rows flush left — the totals
  // below mirror whichever alignment is active so "Front"/"Back" sit under
  // the scores above rather than off to one side.
  const itemStyle = [styles.nineTotalsItem, !columnVisible && styles.nineTotalsItemCentered];
  return (
    <View style={styles.nineTotalsRowWrap}>
      <View style={styles.nineTotalsRow}>
        <View style={itemStyle}>
          <View style={styles.nineTotalsSpacer} />
          <Text style={styles.nineTotalsLabel}>Front</Text>
          <Text style={styles.nineTotalsScore}>{frontTotal}</Text>
        </View>
        {!isNineHoleRound && (
          <View style={itemStyle}>
            <View style={styles.nineTotalsSpacer} />
            <Text style={styles.nineTotalsLabel}>Back</Text>
            <Text style={styles.nineTotalsScore}>{backTotal}</Text>
          </View>
        )}
      </View>
      {onAddPhoto && (
        <TouchableOpacity
          onPress={columnVisible ? null : onAddPhoto}
          disabled={columnVisible}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[
            styles.addPhotoPlusButton,
            columnVisible && styles.addPhotoPlusButtonDimmed,
            hideShareExtras && styles.hidden,
          ]}
          activeOpacity={columnVisible ? 1 : 0.85}
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

// Full-height photo column, rendered once the layout has switched over
// (see `columnVisible` below — the plus tap reveals this column before a
// photo is even picked). Fills the column with either the real photo or,
// while `photoUri` is still null, a dashed "Add Photo" placeholder that's
// tappable the same way a real photo is (`onRequestPhoto` opens the
// picker either way). Reverting back to the no-photo layout is handled by
// the chevron button straddling this column's left edge (see
// `RevertArrowButton` below), not from inside here — and that button only
// ever appears once a real photo exists (see `ScorecardCard`), not while
// the placeholder is showing. No watermark of its own — the golf-ball
// mark has been removed entirely and the text watermark lives below the
// whole card. `hideShareExtras` hides the placeholder from a share
// capture (a real photo still gets captured normally) so an unfinished
// column never ends up in the exported image.
function PhotoColumn({ photoUri, onRequestPhoto, hideShareExtras }) {
  if (!photoUri) {
    return (
      <View style={[styles.photoColumn, hideShareExtras && styles.hidden]}>
        <TouchableOpacity
          onPress={onRequestPhoto}
          style={styles.addPhotoPlaceholder}
          activeOpacity={0.85}
        >
          <Text style={styles.addPhotoPlaceholderIcon}>📷</Text>
          <Text style={styles.addPhotoPlaceholderTitle}>Add Photo</Text>
          <Text style={styles.addPhotoPlaceholderSubtext}>
            Tap to add a photo{'\n'}from your camera roll
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const Wrapper = onRequestPhoto ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.photoColumn}
      onPress={onRequestPhoto}
      activeOpacity={onRequestPhoto ? 0.85 : 1}
    >
      <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
    </Wrapper>
  );
}

// Small chevron pill straddling the boundary between the scores column and
// the photo column (Fix 3), centered vertically on the card body. Tapping it
// reverts to the full-width no-photo layout via `onRemovePhoto`. Only ever
// rendered alongside the photo column, and hidden along with the green plus
// during a share capture via `hideShareExtras` (Fix 4) since it too lives
// inside the captured subtree.
function RevertArrowButton({ onPress, hideShareExtras }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[styles.revertArrowButton, hideShareExtras && styles.hidden]}
    >
      <Text style={styles.revertArrowButtonText}>‹</Text>
    </TouchableOpacity>
  );
}

// Scores (left 48%) + photo (right 52%), side by side, when there's a
// photo. With no photo the scores column expands to the full card width
// instead — front/back nines centered side by side for 18 holes, or a
// single bigger centered column for 9 (Fix 1/4). `onRequestPhoto` is only
// passed by the live "new scorecard" view (it re-opens the picker when the
// existing photo is tapped) — past scorecards fetched from Supabase render
// read-only unless `onAddPhoto` is passed too (see ScorecardDetailModal,
// owner-only). `onAddPhoto`, when passed, renders the green plus beside the
// front/back totals row (Fix 2) — it stays visible even once a photo is
// showing, just dimmed and inert, since `onRemovePhoto` (via the revert
// arrow) is what undoes it. `hideShareExtras` hides both the plus and the
// arrow for the duration of a capture, since they live inside the captured
// subtree. `captureId`, when passed, becomes a real DOM `id` on web (see
// ScorecardScreen's handleShare) so the share capture can target this exact
// element — no photo column means no extra space on the right, and with a
// photo the column already sits flush with the card's own right edge (see
// cardBodyWithPhoto), so capturing this node directly needs no cropping.
// Left undefined by every other caller (e.g. ScorecardDetailModal) so two
// instances never collide on the same id when both happen to be mounted at
// once (the detail modal open over the main screen).
export default function ScorecardCard({
  scorecard,
  fullName,
  photoUri,
  onRequestPhoto,
  onRemovePhoto,
  onAddPhoto,
  showPhotoColumn,
  hideShareExtras,
  captureId,
}) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);
  const diffTextColor = diffColor(diff);
  const compositeName = compositeNameFor(scorecard, isNineHoleRound);
  const hasPhoto = Boolean(photoUri);
  // The green plus can reveal the photo column (`showPhotoColumn`, driven
  // by the caller) before a photo has actually been picked, so the layout
  // switch and the presence of a real photo are tracked separately —
  // `columnVisible` covers both.
  const columnVisible = Boolean(showPhotoColumn) || hasPhoto;
  const nineVariant = columnVisible ? 'compact' : isNineHoleRound ? 'wide9' : 'wide18';
  const frontTotal = sumScore(scorecard.front);
  const backTotal = isNineHoleRound ? null : sumScore(scorecard.back);

  return (
    <View nativeID={captureId} style={styles.cardOuter}>
      <View style={[styles.cardBody, columnVisible && styles.cardBodyWithPhoto]}>
        <View style={[styles.scoresColumn, !columnVisible && styles.scoresColumnFullWidth]}>
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

          <NineTotalsRow
            frontTotal={frontTotal}
            backTotal={backTotal}
            isNineHoleRound={isNineHoleRound}
            onAddPhoto={onAddPhoto}
            columnVisible={columnVisible}
            hideShareExtras={hideShareExtras}
          />

          <View style={styles.divider} />
          <TotalBlock totalScore={totalScore} diffLabel={diffLabel} diffTextColor={diffTextColor} />
        </View>

        {columnVisible && (
          <PhotoColumn photoUri={photoUri} onRequestPhoto={onRequestPhoto} hideShareExtras={hideShareExtras} />
        )}

        {hasPhoto && onRemovePhoto && (
          <RevertArrowButton onPress={onRemovePhoto} hideShareExtras={hideShareExtras} />
        )}
      </View>

      <TextWatermark />
    </View>
  );
}

const styles = StyleSheet.create({
  // This is the root of the ViewShot/html2canvas-captured subtree — clip and
  // round it to match the on-screen card exactly (so the exported image
  // never bleeds past the intended edge) and hold the row of scores/photo
  // plus the full-width text watermark stacked below it.
  cardOuter: {
    backgroundColor: colors.navy,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    padding: 14,
    // Extra headroom above the larger Cinzel player name so its big first
    // letters (32px) don't feel cramped against the card's top edge.
    paddingTop: 14 + 12,
    // Lets the revert arrow (Fix 3) position itself relative to the whole
    // scores+photo row rather than the page, so it can straddle the
    // boundary between the two columns regardless of card height.
    position: 'relative',
  },
  // With a photo, the photo column must reach the card's right edge with
  // nothing beyond it — the no-photo layout keeps its right padding.
  cardBodyWithPhoto: {
    paddingRight: 0,
  },
  scoresColumn: {
    flexGrow: 48,
    flexBasis: 0,
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
    fontFamily: 'Cinzel_700Bold',
    fontSize: 32,
    color: colors.white,
    letterSpacing: 32 * 0.05,
    textTransform: 'uppercase',
  },
  nameSmall: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 22,
    color: colors.white,
    letterSpacing: 22 * 0.05,
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
  // Front/back totals row (Fix 1) — one shared row below the hole scores,
  // not nested per-column, so both items line up on flex:1 and spread
  // across the full width of the scores column. Wrapped in
  // nineTotalsRowWrap so the add-photo plus (Fix 2) can sit to its right as
  // a fixed-width sibling outside the flex:1 spread.
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
  // Once a photo is showing the plus stops doing anything (Fix 2) — the
  // revert arrow undoes it instead — so it dims to read as inert rather
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
  // Hides the plus/arrow from a share capture (Fix 4) without unmounting
  // them, so no layout jump happens when they reappear right after.
  hidden: {
    display: 'none',
  },
  // Each item gets a 13px leading spacer — matching the hole-number
  // column's width — so its score digit lands directly under the hole
  // scores above, plus its own top border echoing the divider above the
  // hole rows.
  nineTotalsItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingTop: 3,
    marginTop: 3,
  },
  // No-photo layout only — mirrors holeRowWide's centering so the totals
  // line up under the centered hole scores above instead of hugging left.
  nineTotalsItemCentered: {
    justifyContent: 'center',
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
  // "Save it Golf" text watermark, centered below the entire card (both
  // scores and photo columns) — never inside the scores column, so it reads
  // as one mark for the whole card rather than something tucked into a
  // corner. No golf-ball art anywhere on the card.
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
  // Photo column
  photoColumn: {
    flexGrow: 52,
    flexBasis: 0,
    // Only the left edge rounds — the right edge is flush with the card's
    // own edge, whose corners are already rounded by cardOuter, so this
    // doesn't leave a mismatched double-rounded seam there.
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  // "Add Photo" placeholder shown in place of the photo image while the
  // column is visible but `photoUri` is still null — fills the whole
  // column (flex: 1 inside `photoColumn`) so the entire area is tappable.
  addPhotoPlaceholder: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 180,
  },
  addPhotoPlaceholderIcon: {
    fontSize: 28,
  },
  addPhotoPlaceholderTitle: {
    color: colors.brightGreen,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Cinzel',
    letterSpacing: 0.5,
  },
  addPhotoPlaceholderSubtext: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  // Revert arrow (Fix 3): straddles the boundary between the scores column
  // (48%) and the photo column (52%), centered vertically on the card body.
  revertArrowButton: {
    position: 'absolute',
    left: '48%',
    top: '50%',
    transform: [{ translateX: -12 }, { translateY: -12 }],
    zIndex: 20,
    backgroundColor: 'rgba(13,31,60,0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revertArrowButtonText: {
    color: colors.white,
    fontSize: 14,
  },
});
