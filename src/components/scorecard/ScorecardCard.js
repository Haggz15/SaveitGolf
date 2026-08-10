import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
// Par: plain white number, no shape.
function ScoreCell({ score, par }) {
  const diff = score - par;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const color = isUnder ? colors.brightGreen : isOver ? colors.red : colors.white;

  return (
    <View
      style={[
        styles.scoreCell,
        isUnder && styles.scoreCellCircle,
        isOver && styles.scoreCellSquare,
        (isUnder || isOver) && { borderColor: color },
      ]}
    >
      <Text style={[styles.scoreDigit, { color }]}>{score}</Text>
    </View>
  );
}

// One nine: each hole row is [hole number, right-aligned | score cell], then
// a total row below reading "<score> FRONT"/"<score> BACK".
function NineColumn({ holes, label }) {
  return (
    <View style={styles.nineColumn}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.holeRow}>
          <Text style={styles.holeNumber}>{h.hole}</Text>
          <ScoreCell score={h.score} par={h.par} />
        </View>
      ))}
      <View style={styles.nineTotalRow}>
        <Text style={styles.nineTotalScore}>{sumScore(holes)}</Text>
        <Text style={styles.nineTotalLabel}>{label}</Text>
      </View>
    </View>
  );
}

// Full-height photo column: tapping it opens the picker (only when
// `onRequestPhoto` is passed — past, read-only scorecards omit it). With no
// photo it shows a dashed placeholder; with a photo it fills the column,
// gets a centered watermark pill along the bottom edge, and (when
// `onRemovePhoto` is passed) a red "Remove" pill top-right to clear it.
function PhotoColumn({ photoUri, onRequestPhoto, onRemovePhoto }) {
  const Wrapper = onRequestPhoto ? TouchableOpacity : View;

  return (
    <Wrapper
      style={styles.photoColumn}
      onPress={onRequestPhoto}
      activeOpacity={onRequestPhoto ? 0.85 : 1}
    >
      {photoUri ? (
        <>
          <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
          <View style={styles.photoWatermarkPill}>
            <Text style={styles.photoWatermarkText}>SaveitGolf</Text>
          </View>
          {onRemovePhoto && (
            <TouchableOpacity
              onPress={onRemovePhoto}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.removePhotoButton}
            >
              <Text style={styles.removePhotoButtonText}>✕ Remove</Text>
            </TouchableOpacity>
          )}
        </>
      ) : (
        <View style={styles.photoEmpty}>
          <Ionicons name="camera-outline" size={22} color={colors.muted} />
          <Text style={styles.photoEmptyText}>Add Photo</Text>
        </View>
      )}
    </Wrapper>
  );
}

// Scores (left 48%) + photo (right 52%), side by side. `onRequestPhoto` is
// only passed by the live "new scorecard" view — past scorecards fetched
// from Supabase render read-only with no tap target on the photo.
// `hidePhotoColumn` drives the hidden no-photo share-card capture (Fix 4):
// when true the photo column is omitted entirely rather than falling back
// to the dashed "Add Photo" placeholder, so it never ends up in a saved image.
export default function ScorecardCard({ scorecard, fullName, photoUri, onRequestPhoto, onRemovePhoto, hidePhotoColumn }) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);
  const diffTextColor = diffColor(diff);
  const compositeName = compositeNameFor(scorecard, isNineHoleRound);

  return (
    <View style={styles.cardBody}>
      <View style={styles.scoresColumn}>
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
          <NineColumn holes={scorecard.front} label="FRONT" />
          {!isNineHoleRound && <NineColumn holes={scorecard.back} label="BACK" />}
        </View>

        <View style={styles.totalBlock}>
          <View style={styles.totalRow}>
            <Text style={styles.totalScore}>{totalScore}</Text>
            <Text style={[styles.totalDiff, { color: diffTextColor }]}>({diffLabel})</Text>
          </View>
          <Text style={styles.blockWatermark}>SaveitGolf</Text>
        </View>
      </View>

      {!hidePhotoColumn && (
        <PhotoColumn photoUri={photoUri} onRequestPhoto={onRequestPhoto} onRemovePhoto={onRemovePhoto} />
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
  },
  scoresColumn: {
    flexGrow: 48,
    flexBasis: 0,
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
    fontSize: 7,
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
  holeNumber: {
    width: 14,
    textAlign: 'right',
    color: colors.muted,
    fontSize: 8,
  },
  scoreCell: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDigit: {
    fontSize: 12,
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
  nineTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 6,
  },
  nineTotalScore: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  nineTotalLabel: {
    color: '#6a8ab0',
    fontSize: 7,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  // Total block
  totalBlock: {
    position: 'relative',
    marginTop: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  totalScore: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
  },
  totalDiff: {
    fontSize: 13,
    fontWeight: '700',
  },
  blockWatermark: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    fontFamily: 'DancingScript_700Bold',
    fontSize: 11,
    color: colors.white,
    opacity: 0.4,
  },
  // Photo column
  photoColumn: {
    flexGrow: 52,
    flexBasis: 0,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    ...StyleSheet.absoluteFillObject,
  },
  photoEmpty: {
    flex: 1,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#1a2e4a',
    borderRadius: 8,
    backgroundColor: '#1a2e4a',
  },
  photoEmptyText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  photoWatermarkPill: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
  },
  photoWatermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 12,
    color: colors.white,
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
