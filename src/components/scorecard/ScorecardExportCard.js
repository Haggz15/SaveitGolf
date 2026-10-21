import { View, Text, Image, StyleSheet } from 'react-native';
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

// Birdie: green circle around the number. Bogey: red square. Par: plain
// white number, no shape. Eagle (or better) adds a second green circle
// around the first; double bogey adds a second red square. Triple bogey or
// worse keeps the double square but thickens the outer ring and tints the
// inside red so it reads as worse than a double. The extra ring is
// absolutely positioned outside the cell, so the cell keeps its 20pt
// footprint and stays centered on the score column; ringed cells just get
// a little vertical margin so stacked rings don't collide. When `parsKnown`
// is false (course not in the API) every score is a plain white number.
function ScoreCell({ score, par, parsKnown = true }) {
  const diff = parsKnown ? score - par : 0;
  const isUnder = diff <= -1;
  const isOver = diff >= 1;
  const hasOuterRing = diff <= -2 || diff >= 2;
  const isTriplePlus = diff >= 3;
  const color = isUnder ? colors.brightGreen : isOver ? colors.red : colors.white;

  return (
    <View
      style={[
        styles.scoreCellBase,
        isUnder && styles.scoreCellCircle,
        isOver && styles.scoreCellSquare,
        (isUnder || isOver) && { borderColor: color },
        hasOuterRing && styles.scoreCellRinged,
        isTriplePlus && styles.scoreCellTripleFill,
      ]}
    >
      {hasOuterRing && (
        <View
          pointerEvents="none"
          style={[
            isUnder ? styles.scoreOuterCircle : styles.scoreOuterSquare,
            isTriplePlus && styles.scoreOuterTriple,
            { borderColor: color },
          ]}
        />
      )}
      <Text style={[styles.scoreDigit, { color }]}>{score}</Text>
    </View>
  );
}

// One nine (front or back): each hole row is [hole number | score cell], no
// heading above — the label only reappears once, in the total row below the
// nine scores. That row mirrors holeRow's slots so the total sits directly
// under the score column with "FRONT"/"BACK" inline to its left; both texts
// are wider than their slots, so they use fixed widths with negative
// margins that keep the slot footprint identical to the hole rows.
export function ExportNineColumn({ holes, label, style, parsKnown }) {
  return (
    <View style={style}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.holeRow}>
          <Text style={styles.holeNumber}>{h.hole}</Text>
          <ScoreCell score={h.score} par={h.par} parsKnown={parsKnown} />
        </View>
      ))}
      <View style={styles.nineDivider} />
      <View style={styles.nineTotalRow}>
        <View style={styles.nineTotalLabelSlot}>
          <Text style={styles.nineTotalLabel} numberOfLines={1}>{label}</Text>
        </View>
        <View style={styles.nineTotalScoreSlot}>
          <Text style={styles.nineTotalScore} numberOfLines={1}>{sumScore(holes)}</Text>
        </View>
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

// Dimmed (0.45 opacity) app logo plus "SaveitGolf" script text, meant to
// sit inside the grand-total block's bottom-right corner — used whether or
// not the card has a photo background.
export function BallWatermark({ style }) {
  return (
    <View style={[styles.ballWatermarkRow, style]}>
      <Image source={require('../../../assets/icon.png')} style={styles.ballWatermarkLogo} />
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
  // Outer ring sits 3pt outside the cell's 1.4pt border (absolute offsets
  // are measured from inside the border, hence -4.4).
  scoreCellRinged: {
    marginVertical: 3,
  },
  scoreOuterCircle: {
    position: 'absolute',
    top: -4.4,
    left: -4.4,
    right: -4.4,
    bottom: -4.4,
    borderWidth: 1.4,
    borderRadius: 13,
  },
  scoreOuterSquare: {
    position: 'absolute',
    top: -4.4,
    left: -4.4,
    right: -4.4,
    bottom: -4.4,
    borderWidth: 1.4,
    borderRadius: 4,
  },
  scoreOuterTriple: {
    borderWidth: 2.4,
  },
  scoreCellTripleFill: {
    backgroundColor: 'rgba(192,0,26,0.3)',
  },
  nineDivider: {
    height: 1,
    backgroundColor: colors.navyBorder,
    marginTop: 6,
    marginBottom: 6,
  },
  nineTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Same width as holeNumber; the label overflows leftward, right-aligned.
  nineTotalLabelSlot: {
    width: 14,
    alignItems: 'flex-end',
  },
  nineTotalLabel: {
    width: 50,
    marginLeft: -36,
    // With the row's 6pt gap this gives ~8pt between label and score.
    marginRight: 2,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.9)',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  // Same width as scoreCellBase; the total is centered on the score column.
  nineTotalScoreSlot: {
    width: 20,
    alignItems: 'center',
  },
  nineTotalScore: {
    width: 36,
    marginHorizontal: -8,
    textAlign: 'center',
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
  ballWatermarkLogo: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  ballWatermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 7,
    color: colors.white,
  },
});
