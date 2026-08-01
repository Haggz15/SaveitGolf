import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';

// Shows every scorecard a user has logged, newest first. Works for both the
// signed-in user and another user's profile — it's parameterized entirely
// by `userId`, not tied to the auth session.
export default function UserScorecardsScreen({ route, navigation }) {
  const { userId, displayName } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const [detailScorecard, setDetailScorecard] = useState(null);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayName ? `${displayName}'s Scorecards` : 'Scorecards'}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {userId && <PastScorecardsList userId={userId} onSelect={setDetailScorecard} />}
      </ScrollView>

      <ScorecardDetailModal
        visible={Boolean(detailScorecard)}
        scorecard={detailScorecard}
        fullName={displayName}
        onClose={() => setDetailScorecard(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  backButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
});
