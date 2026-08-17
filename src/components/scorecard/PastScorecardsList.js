import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Alert } from 'react-native';
import colors from '../../theme/colors';
import { getScorecards, deleteScorecard, setScorecardPinned } from '../../services/scorecards';
import { useAuth } from '../../context/AuthContext';

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
  const { user } = useAuth();
  const [scorecards, setScorecards] = useState([]);
  const [loading, setLoading] = useState(true);
  // Delete/pin only make sense for the signed-in user's own list — someone
  // viewing another golfer's scorecards (UserScorecardsScreen) gets a
  // read-only list, same as the rest of that screen.
  const isOwnList = Boolean(user?.id) && user.id === userId;

  const loadScorecards = useCallback(() => {
    if (!userId) return;
    setLoading(true);
    getScorecards(userId)
      .then(setScorecards)
      .catch((err) => console.error('Failed to load past scorecards:', err))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadScorecards();
  }, [loadScorecards]);

  function handleDeleteScorecard(scorecardId) {
    const runDelete = async () => {
      try {
        await deleteScorecard(scorecardId);
        setScorecards((prev) => prev.filter((s) => s.id !== scorecardId));
      } catch (err) {
        console.error('Failed to delete scorecard:', err);
        if (Platform.OS === 'web') {
          window.alert('Could not delete scorecard');
        } else {
          Alert.alert('Error', 'Could not delete scorecard');
        }
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete this scorecard? This cannot be undone.')) {
        runDelete();
      }
      return;
    }

    Alert.alert(
      'Delete Scorecard',
      'Are you sure you want to delete this scorecard? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: runDelete },
      ]
    );
  }

  // Pinning reorders the list (pinned row jumps to the top) and may unpin a
  // different row, so it just reloads from Supabase rather than patching
  // local state in place.
  async function handlePinScorecard(scorecardId, currentlyPinned) {
    try {
      await setScorecardPinned(userId, scorecardId, !currentlyPinned);
      loadScorecards();
    } catch (err) {
      console.error('Failed to pin scorecard:', err);
    }
  }

  if (loading) {
    return <ActivityIndicator color={colors.red} style={{ marginTop: 16 }} />;
  }

  if (scorecards.length === 0) {
    return <Text style={styles.emptyText}>{emptyText ?? "No scorecards logged yet."}</Text>;
  }

  return (
    <View>
      {scorecards.map((item) => (
        <View key={item.id} style={styles.cardWrap}>
          <TouchableOpacity
            style={[styles.row, isOwnList && styles.rowWithActions, item.pinned && styles.rowPinned]}
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

          {item.pinned && (
            <View style={styles.pinnedBadge}>
              <Text style={styles.pinnedBadgeText}>PINNED</Text>
            </View>
          )}

          {isOwnList && (
            <>
              <TouchableOpacity
                onPress={() => handlePinScorecard(item.id, item.pinned)}
                style={[styles.pinButton, item.pinned && styles.pinButtonActive]}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.iconButtonText}>📌</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDeleteScorecard(item.id)}
                style={styles.deleteButton}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.iconButtonText}>🗑️</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
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
  cardWrap: {
    position: 'relative',
    marginBottom: 10,
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
  },
  // Leaves clear room for the pin/delete buttons overlaid in the top-right
  // corner so they don't sit on top of the score digits.
  rowWithActions: {
    paddingRight: 78,
  },
  // Leaves clear room for the PINNED badge overlaid in the top-left corner
  // so it doesn't sit on top of the course name.
  rowPinned: {
    paddingTop: 26,
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
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(192,0,26,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButton: {
    position: 'absolute',
    top: 8,
    right: 42,
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(77,216,96,0.15)',
    borderWidth: 0.5,
    borderColor: colors.brightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinButtonActive: {
    backgroundColor: colors.brightGreen,
  },
  iconButtonText: {
    fontSize: 14,
  },
  pinnedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.brightGreen,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  pinnedBadgeText: {
    color: colors.brightGreenText,
    fontSize: 9,
    fontWeight: '700',
  },
});
