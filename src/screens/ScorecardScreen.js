import { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import colors from '../theme/colors';
import { scorecard, currentUser } from '../data/mockData';

const holes = [...scorecard.front, ...scorecard.back];

function ScoreBadge({ score, par }) {
  const diff = score - par;
  let node = <Text style={styles.scoreNumber}>{score}</Text>;

  if (diff <= -1) {
    const rings = Math.min(-diff, 3);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.circleRing}>{node}</View>;
    }
  } else if (diff >= 1) {
    const rings = Math.min(diff, 3);
    for (let i = 0; i < rings; i++) {
      node = <View style={styles.squareRing}>{node}</View>;
    }
  }

  return <View style={styles.scoreBadge}>{node}</View>;
}

function HoleRow({ hole }) {
  return (
    <View style={styles.holeRow}>
      <Text style={styles.holeNumber}>{hole.hole}</Text>
      <Text style={styles.holePar}>Par {hole.par}</Text>
      <ScoreBadge score={hole.score} par={hole.par} />
    </View>
  );
}

export default function ScorecardScreen() {
  const viewShotRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);

  const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
  const totalScore = holes.reduce((sum, h) => sum + h.score, 0);
  const diff = totalScore - totalPar;
  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`;

  async function handleShare() {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Sharing your scorecard is only available in the mobile app.');
      return;
    }

    try {
      setIsSharing(true);

      // Required lazily: these native modules aren't available on web and
      // throw at import time if loaded statically there.
      const MediaLibrary = require('expo-media-library');
      const Sharing = require('expo-sharing');

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to save your scorecard.');
        return;
      }

      const uri = await viewShotRef.current.capture();
      await MediaLibrary.saveToLibraryAsync(uri);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { dialogTitle: 'Share your scorecard' });
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not export your scorecard. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cardWrapper}>
          <ViewShot
            ref={viewShotRef}
            style={styles.card}
            options={{ format: 'png', quality: 1 }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.playedCourseName}>{scorecard.courseName}</Text>
            </View>

            <View style={styles.holesList}>
              {holes.map((h) => (
                <HoleRow key={h.hole} hole={h} />
              ))}
            </View>

            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalScore}>{totalScore}</Text>
                <Text
                  style={[
                    styles.totalDiff,
                    diff > 0 ? styles.diffOver : diff < 0 ? styles.diffUnder : styles.diffEven,
                  ]}
                >
                  ({diffLabel})
                </Text>
              </View>
              <Text style={styles.totalMeta}>
                {scorecard.courseName} · {scorecard.date}
              </Text>
            </View>

            <View style={styles.watermark}>
              <Text style={styles.watermarkText}>SaveitGolf</Text>
            </View>
          </ViewShot>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={15} color={colors.white} />
            <Text style={styles.shareButtonText}>{isSharing ? 'Saving…' : 'Share'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.circleRing}>
              <Text style={styles.legendGlyph}>4</Text>
            </View>
            <Text style={styles.legendText}>Birdie / Eagle / Albatross</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.squareRing}>
              <Text style={styles.legendGlyph}>6</Text>
            </View>
            <Text style={styles.legendText}>Bogey / Double / Triple</Text>
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
  cardWrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: colors.navyCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  cardHeader: {
    paddingRight: 90,
    marginBottom: 14,
  },
  userName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  playedCourseName: {
    color: colors.white,
    fontSize: 14,
    marginTop: 2,
    opacity: 0.85,
  },
  shareButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  holesList: {
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  holeNumber: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    width: 22,
  },
  holePar: {
    color: colors.offWhite,
    fontSize: 13,
    width: 48,
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
  circleRing: {
    borderWidth: 1.5,
    borderColor: colors.gold,
    borderRadius: 999,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareRing: {
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 3,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalSection: {
    alignItems: 'center',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  totalScore: {
    color: colors.white,
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 46,
  },
  totalDiff: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 7,
  },
  diffOver: {
    color: colors.red,
  },
  diffUnder: {
    color: colors.gold,
  },
  diffEven: {
    color: colors.offWhite,
  },
  totalMeta: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  watermark: {
    alignItems: 'flex-end',
    marginTop: 14,
  },
  watermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 16,
    color: colors.muted,
    opacity: 0.9,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendGlyph: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 12,
    textAlign: 'center',
  },
  legendText: {
    color: colors.muted,
    fontSize: 12,
  },
});
