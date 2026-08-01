import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import colors from '../../theme/colors';
import { getScorecards } from '../../services/scorecards';

function diffLabelFor(totalScore, totalPar) {
  const diff = totalScore - totalPar;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function diffColor(totalScore, totalPar) {
  const diff = totalScore - totalPar;
  if (diff > 0) return colors.red;
  if (diff < 0) return colors.green;
  return colors.offWhite;
}

// Newest-first list of a user's logged rounds — used on the Scorecard
// screen (current user) and the Scorecards screen (self or another user).
// Tapping a row hands the full mapped scorecard back to `onSelect`.
export default function PastScorecardsList({ userId, onSelect, emptyText }) {
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    getScorecards(userId)
      .then(setScorecards)
      .catch((err) => console.error('Failed to load past scorecards:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return <ActivityIndicator color={colors.red} style={{ marginTop: 16 }} />;
  }

  if (scorecards.length === 0) {
    return <Text style={styles.emptyText}>{emptyText ?? "No scorecards logged yet."}</Text>;
  }

  return (
    <View>
      {scorecards.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={styles.row}
          onPress={() => onSelect(item)}
          activeOpacity={0.8}
        >
          <View style={styles.rowInfo}>
            <Text style={styles.rowCourse} numberOfLines={1}>
              {item.courseName}
            </Text>
            <Text style={styles.rowDate}>{item.date}</Text>
          </View>
          <View style={styles.rowScoreBlock}>
            <Text style={styles.rowScore}>{item.totalScore}</Text>
            <Text style={[styles.rowDiff, { color: diffColor(item.totalScore, item.totalPar) }]}>
              {diffLabelFor(item.totalScore, item.totalPar)}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  rowInfo: {
    flex: 1,
    marginRight: 12,
  },
  rowCourse: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  rowDate: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  rowScoreBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rowScore: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  rowDiff: {
    fontSize: 13,
    fontWeight: '700',
  },
});
