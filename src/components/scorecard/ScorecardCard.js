import { View, Text, StyleSheet } from 'react-native';
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

function ScoreBadge({ score, par }) {
  const diff = score - par;
  let node = <Text style={styles.scoreNumber}>{score}</Text>;

  if (diff <= -1) {
    const rings = Math.min(-diff, 2);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.circleRing}>{node}</View>;
    }
  } else if (diff >= 1) {
    const rings = Math.min(diff, 2);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.squareRing}>{node}</View>;
    }
  }

  return <View style={styles.scoreBadge}>{node}</View>;
}

// Each column carries its own FRONT/BACK total directly beneath its holes,
// so the total always lines up under the column it belongs to.
export function NineColumn({ holes, totalLabel }) {
  return (
    <View style={styles.column}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.columnRow}>
          <ScoreBadge score={h.score} par={h.par} />
        </View>
      ))}
      <View style={styles.columnTotalRow}>
        <Text style={styles.columnTotalLabel}>{totalLabel}</Text>
        <Text style={styles.columnTotalValue}>{sumScore(holes)}</Text>
      </View>
    </View>
  );
}

export function GrandTotal({ totalScore, diffLabel, diff }) {
  return (
    <View style={styles.totalBlock}>
      <View style={styles.totalRow}>
        <Text style={styles.totalScore}>{totalScore}</Text>
        <Text style={[styles.totalDiff, { color: diffColor(diff) }]}>({diffLabel})</Text>
      </View>
    </View>
  );
}

// Compact on-screen card: name, course, front/back columns (each with its
// own total), grand total, watermark. `photoSlot`, when provided, renders as
// a third item alongside the columns — used by the live "new scorecard"
// view; past scorecards fetched from Supabase never have a photo attached,
// so callers viewing history simply omit it.
export default function ScorecardCard({ scorecard, fullName, photoSlot }) {
  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(scorecard);

  return (
    <View style={styles.cardBody}>
      <Text style={styles.userName}>{fullName}</Text>
      <Text style={styles.courseNameText} numberOfLines={2}>
        {scorecard.courseName}
      </Text>

      <View style={styles.scoresRow}>
        <NineColumn holes={scorecard.front} totalLabel="FRONT" />
        {!isNineHoleRound && <NineColumn holes={scorecard.back} totalLabel="BACK" />}
        {photoSlot}
      </View>

      <GrandTotal totalScore={totalScore} diffLabel={diffLabel} diff={diff} />

      <View style={styles.watermarkWrap}>
        <Text style={styles.watermarkText}>SaveitGolf</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardBody: {
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 34,
    position: 'relative',
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
    color: colors.white,
    fontSize: 13,
    marginTop: 6,
  },
  scoresRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  column: {
    flex: 1,
  },
  columnRow: {
    alignItems: 'flex-start',
    paddingVertical: 3,
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
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  columnTotalValue: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '800',
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    minWidth: 20,
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 5,
  },
  totalScore: {
    color: colors.white,
    fontSize: 56,
    fontWeight: '900',
    lineHeight: 58,
  },
  totalDiff: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
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
