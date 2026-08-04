import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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

function diffColor(diff) {
  if (diff > 0) return colors.red;
  if (diff < 0) return colors.green;
  return colors.offWhite;
}

// Birdie/eagle: green ring(s), green text. Bogey/double bogey: red square(s),
// red text. Par: plain white number, no indicator.
function ScoreBadge({ score, par }) {
  const diff = score - par;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const color = isUnder ? colors.green : isOver ? colors.red : colors.white;

  let node = <Text style={[styles.scoreNumber, { color }]}>{score}</Text>;

  if (isUnder) {
    const rings = Math.min(-diff, 2);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.circleRing}>{node}</View>;
    }
  } else if (isOver) {
    const rings = Math.min(diff, 2);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.squareRing}>{node}</View>;
    }
  }

  return <View style={styles.scoreBadge}>{node}</View>;
}

// One nine (front or back): small grey label at top, each hole row with the
// hole number (small, grey, left) and the score (bold, right), then a total
// row separated by a thin divider line.
export function NineColumn({ holes, label }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      {holes.map((h) => (
        <View key={h.hole} style={styles.columnRow}>
          <Text style={styles.holeNumber}>{h.hole}</Text>
          <ScoreBadge score={h.score} par={h.par} />
        </View>
      ))}
      <View style={styles.columnTotalRow}>
        <Text style={styles.columnTotalLabel}>{label}</Text>
        <Text style={styles.columnTotalValue}>{sumScore(holes)}</Text>
      </View>
    </View>
  );
}

export function GrandTotal({ totalScore, diffLabel, diff }) {
  return (
    <View style={styles.totalBlock}>
      <Text style={styles.totalBlockLabel}>TOTAL</Text>
      <View style={styles.totalRow}>
        <Text style={styles.totalScore}>{totalScore}</Text>
        <Text style={[styles.totalDiff, { color: diffColor(diff) }]}>({diffLabel})</Text>
      </View>
    </View>
  );
}

// Full scorecard: header (name / course / optional Share button), scores row
// (front+back nines on the left, photo slot ~90px on the right, matching
// height), grand total centered under the nines, watermark. `onShare` and
// `photoSlot` are only passed by the live "new scorecard" view — past
// scorecards fetched from Supabase render read-only with neither.
export default function ScorecardCard({ scorecard, fullName, photoSlot, onShare, sharing }) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);

  return (
    <View style={styles.cardBody}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.courseNameText} numberOfLines={2}>
            {scorecard.courseName}
          </Text>
        </View>

        {onShare && (
          <TouchableOpacity
            style={styles.shareButton}
            onPress={onShare}
            disabled={sharing}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={13} color={colors.white} />
            <Text style={styles.shareButtonText}>{sharing ? 'Saving…' : 'Share'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.mainRow}>
        <View style={styles.leftSection}>
          <View style={styles.ninesRow}>
            <NineColumn holes={scorecard.front} label="FRONT" />
            {!isNineHoleRound && <NineColumn holes={scorecard.back} label="BACK" />}
          </View>

          <GrandTotal totalScore={totalScore} diffLabel={diffLabel} diff={diff} />
        </View>

        {photoSlot && <View style={styles.photoColumn}>{photoSlot}</View>}
      </View>

      <View style={styles.watermarkWrap}>
        <Text style={styles.watermarkText}>SaveitGolf</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    paddingTop: 18,
    paddingHorizontal: 14,
    paddingBottom: 34,
    position: 'relative',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  userName: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  courseNameText: {
    fontFamily: 'Cinzel_700Bold',
    color: colors.lightBlue,
    fontSize: 12,
    marginTop: 6,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.red,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  mainRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  leftSection: {
    flex: 1,
  },
  ninesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoColumn: {
    width: 90,
  },
  column: {
    flex: 1,
  },
  columnLabel: {
    color: '#6a8ab0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  holeNumber: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  columnTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  columnTotalLabel: {
    color: '#6a8ab0',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columnTotalValue: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 16,
    fontWeight: '700',
    width: 24,
    height: 24,
    lineHeight: 24,
    textAlign: 'center',
  },
  circleRing: {
    borderWidth: 1.6,
    borderColor: colors.green,
    borderRadius: 999,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareRing: {
    borderWidth: 1.6,
    borderColor: colors.red,
    borderRadius: 4,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalBlock: {
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  totalBlockLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  totalScore: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 34,
  },
  totalDiff: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 5,
  },
  watermarkWrap: {
    position: 'absolute',
    bottom: 10,
    right: 14,
  },
  watermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
