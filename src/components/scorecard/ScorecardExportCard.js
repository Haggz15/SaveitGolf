import { View, Text, StyleSheet } from 'react-native';
import GolfBallMark, { useGolfBallFont } from '../common/GolfBallMark';
import { sumScore } from './ScorecardCard';
import colors from '../../theme/colors';

// Everything in this file is exclusively for the hidden ViewShot export
// template in ScorecardScreen.js (used for both the plain-navy and
// photo-background share cards) — the live on-screen scorecard
// (ScorecardCard.js) and the read-only past-round view
// (ScorecardDetailModal.js) intentionally keep their own older, denser
// styling and are untouched by this file.

function splitNameWords(fullName) {
  return (fullName || '').trim().split(/\s+/).filter(Boolean);
}

// "OWEN HAGGERTY" -> O and H rendered larger than the rest of their words.
// A single-word name collapses first-word/last-word onto the same letter.
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

// Name + course name + the divider that separates them from the scores
// below. `style` lets each template control its own outer padding.
export function NameSection({ fullName, courseName, style }) {
  return (
    <View style={style}>
      <StyledPlayerName fullName={fullName} />
      <Text style={styles.courseNameText} numberOfLines={2}>
        {courseName}
      </Text>
      <View style={styles.nameSectionDivider} />
    </View>
  );
}

// Birdie/eagle: green circle(s) around the number. Bogey/double bogey: red
// square(s). Par: plain white number, no shape. Eagle/double-bogey (2+ under
// or over) add a second, larger ring around the first for "two circles"/"two
// squares".
function ScoreCell({ score, par }) {
  const diff = score - par;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const color = isUnder ? colors.brightGreen : isOver ? colors.red : colors.white;
  const ringCount = isUnder ? Math.min(-diff, 2) : isOver ? Math.min(diff, 2) : 0;

  let node = (
    <View
      style={[
        styles.scoreCellBase,
        ringCount >= 1 && (isUnder ? styles.scoreCellCircle : styles.scoreCellSquare),
        ringCount >= 1 && { borderColor: color },
      ]}
    >
      <Text style={[styles.scoreDigit, { color }]}>{score}</Text>
    </View>
  );

  if (ringCount >= 2) {
    node = (
      <View style={[isUnder ? styles.scoreOuterCircle : styles.scoreOuterSquare, { borderColor: color }]}>
        {node}
      </View>
    );
  }

  return node;
}

// One nine (front or back): each hole row is [hole number | score cell], no
// heading above — the label only reappears once, in the total row below the
// nine scores.
export function ExportNineColumn({ holes, label, style }) {
  return (
    <View style={style}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.holeRow}>
          <Text style={styles.holeNumber}>{h.hole}</Text>
          <ScoreCell score={h.score} par={h.par} />
        </View>
      ))}
      <View style={styles.nineDivider} />
      <View style={styles.nineTotalRow}>
        <Text style={styles.nineTotalLabel}>{label}</Text>
        <Text style={styles.nineTotalScore}>{sumScore(holes)}</Text>
      </View>
    </View>
  );
}

function diffColor(diff) {
  if (diff > 0) return colors.red;
  if (diff < 0) return colors.brightGreen;
  return colors.white;
}

// The final total score, large and bold, with the over/under/even-par label
// colored per diff. `children` is used to anchor a watermark inside this
// block's bottom-right corner (see BallWatermark below).
export function ExportGrandTotal({ totalScore, diffLabel, diff, style, children }) {
  return (
    <View style={[styles.totalBlock, style]}>
      <View style={styles.totalRow}>
        <Text style={styles.totalScoreText}>{totalScore}</Text>
        <Text style={[styles.totalDiffText, { color: diffColor(diff) }]}>{diffLabel}</Text>
      </View>
      {children}
    </View>
  );
}

// Dimmed (0.45 opacity) ball mark plus "SaveitGolf" script text, meant to
// sit inside the grand-total block's bottom-right corner — used whether or
// not the card has a photo background.
export function BallWatermark({ style }) {
  const fontFamily = useGolfBallFont();
  return (
    <View style={[styles.ballWatermarkRow, style]}>
      <GolfBallMark fontFamily={fontFamily} displayWidth={22} />
      <Text style={styles.ballWatermarkText}>SaveitGolf</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nameLine: {
    textTransform: 'uppercase',
  },
  nameBig: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 22,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 22 * 0.06,
    textTransform: 'uppercase',
  },
  nameSmall: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 15,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 15 * 0.06,
    textTransform: 'uppercase',
  },
  courseNameText: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 7.5,
    color: colors.lightBlue,
    letterSpacing: 7.5 * 0.04,
    marginTop: 5,
  },
  nameSectionDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: 10,
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  holeNumber: {
    width: 14,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  scoreCellBase: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreDigit: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreCellCircle: {
    borderWidth: 1.4,
    borderRadius: 10,
  },
  scoreCellSquare: {
    borderWidth: 1.4,
    borderRadius: 2,
  },
  scoreOuterCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreOuterSquare: {
    width: 26,
    height: 26,
    borderRadius: 3,
    borderWidth: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nineDivider: {
    height: 1,
    backgroundColor: colors.navyBorder,
    marginTop: 6,
    marginBottom: 6,
  },
  nineTotalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 5,
  },
  nineTotalLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  nineTotalScore: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  totalBlock: {
    position: 'relative',
    alignItems: 'center',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 6,
  },
  totalScoreText: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '800',
  },
  totalDiffText: {
    fontSize: 16,
    fontWeight: '700',
  },
  ballWatermarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    opacity: 0.45,
  },
  ballWatermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 7,
    color: colors.white,
  },
});
