import { View, Text, StyleSheet, ScrollView } from 'react-native';
import Header from '../components/Header';
import colors from '../theme/colors';
import { scorecard } from '../data/mockData';

function scoreStyle(score, par) {
  const diff = score - par;
  if (diff <= -2) return styles.scoreEagle;
  if (diff === -1) return styles.scoreBirdie;
  if (diff >= 2) return styles.scoreDouble;
  if (diff === 1) return styles.scoreBogey;
  return styles.scorePar;
}

function ScoreCell({ score, par }) {
  const diff = score - par;
  const isCircled = diff <= -1;
  return (
    <View style={styles.scoreCell}>
      <View style={[styles.scoreShape, isCircled && styles.scoreCircle]}>
        <Text style={[styles.scoreText, scoreStyle(score, par)]}>{score}</Text>
      </View>
    </View>
  );
}

function NineTable({ title, holes }) {
  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);

  return (
    <View style={styles.table}>
      <Text style={styles.tableTitle}>{title}</Text>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.headerCell, styles.holeColumn]}>Hole</Text>
        <Text style={styles.headerCell}>Par</Text>
        <Text style={styles.headerCell}>Score</Text>
      </View>

      {holes.map((h) => (
        <View key={h.hole} style={styles.tableRow}>
          <Text style={[styles.cell, styles.holeColumn]}>{h.hole}</Text>
          <Text style={styles.cell}>{h.par}</Text>
          <ScoreCell score={h.score} par={h.par} />
        </View>
      ))}

      <View style={[styles.tableRow, styles.totalRow]}>
        <Text style={[styles.cell, styles.holeColumn, styles.totalLabel]}>OUT</Text>
        <Text style={[styles.cell, styles.totalLabel]}>{totalPar}</Text>
        <Text style={[styles.cell, styles.totalLabel]}>{totalScore}</Text>
      </View>
    </View>
  );
}

export default function ScorecardScreen() {
  const frontPar = scorecard.front.reduce((s, h) => s + h.par, 0);
  const backPar = scorecard.back.reduce((s, h) => s + h.par, 0);
  const frontScore = scorecard.front.reduce((s, h) => s + h.score, 0);
  const backScore = scorecard.back.reduce((s, h) => s + h.score, 0);
  const totalPar = frontPar + backPar;
  const totalScore = frontScore + backScore;

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <Text style={styles.courseName}>{scorecard.courseName}</Text>
          <Text style={styles.date}>{scorecard.date}</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalScore}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalPar}</Text>
              <Text style={styles.summaryLabel}>Par</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, styles.summaryDiff]}>
                {totalScore - totalPar > 0 ? `+${totalScore - totalPar}` : totalScore - totalPar}
              </Text>
              <Text style={styles.summaryLabel}>To Par</Text>
            </View>
          </View>
        </View>

        <View style={styles.columns}>
          <NineTable title="Front Nine" holes={scorecard.front} />
          <NineTable title="Back Nine" holes={scorecard.back} />
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.scoreCircle]}>
              <Text style={[styles.scoreText, styles.scoreBirdie]}>B</Text>
            </View>
            <Text style={styles.legendText}>Birdie or better</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.legendSwatch}>
              <Text style={[styles.scoreText, styles.scoreBogey]}>B</Text>
            </View>
            <Text style={styles.legendText}>Bogey or worse</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  summaryCard: {
    backgroundColor: colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    padding: 16,
    marginBottom: 16,
  },
  courseName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  date: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  summaryDiff: {
    color: colors.red,
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  columns: {
    flexDirection: 'row',
    gap: 10,
  },
  table: {
    flex: 1,
    backgroundColor: colors.navyCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  tableTitle: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingBottom: 6,
    marginBottom: 4,
  },
  headerCell: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  cell: {
    flex: 1,
    color: colors.offWhite,
    fontSize: 13,
    textAlign: 'center',
  },
  holeColumn: {
    color: colors.muted,
  },
  scoreCell: {
    flex: 1,
    alignItems: 'center',
  },
  scoreShape: {
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircle: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 13,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  scorePar: {
    color: colors.offWhite,
  },
  scoreBirdie: {
    color: colors.gold,
  },
  scoreEagle: {
    color: colors.gold,
  },
  scoreBogey: {
    color: colors.red,
    fontWeight: '800',
  },
  scoreDouble: {
    color: colors.red,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
    marginTop: 6,
    paddingTop: 8,
  },
  totalLabel: {
    color: colors.white,
    fontWeight: '700',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendSwatch: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  legendText: {
    color: colors.muted,
    fontSize: 12,
  },
});
