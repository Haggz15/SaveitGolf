import { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import colors from '../theme/colors';
import { scorecard, currentUser } from '../data/mockData';

function sumPar(holes) {
  return holes.reduce((sum, h) => sum + h.par, 0);
}

function sumScore(holes) {
  return holes.reduce((sum, h) => sum + h.score, 0);
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

function NineColumn({ holes, label }) {
  const total = sumScore(holes);

  return (
    <View style={styles.column}>
      {holes.map((h) => (
        <View key={h.hole} style={styles.columnRow}>
          <ScoreBadge score={h.score} par={h.par} />
        </View>
      ))}

      <View style={styles.columnTotalBlock}>
        <Text style={styles.columnTotalText}>{total}</Text>
        <Text style={styles.columnTotalLabel}>{label}</Text>
      </View>
    </View>
  );
}

function PhotoBox({ uri, onPress }) {
  return (
    <TouchableOpacity style={styles.photoBox} onPress={onPress} activeOpacity={0.85}>
      {uri ? (
        <Image source={{ uri }} style={styles.photoImage} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="camera-outline" size={30} color={colors.muted} />
          <Text style={styles.photoPlaceholderText}>Add your photo</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ScorecardScreen() {
  const viewShotRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);

  const isNineHoleRound = !scorecard.back || scorecard.back.length === 0;

  const totalPar = sumPar(scorecard.front) + (isNineHoleRound ? 0 : sumPar(scorecard.back));
  const totalScore = sumScore(scorecard.front) + (isNineHoleRound ? 0 : sumScore(scorecard.back));
  const diff = totalScore - totalPar;
  const diffLabel = diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`;
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`.toUpperCase();

  async function handlePickPhoto() {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Adding a photo is only available in the mobile app.');
      return;
    }

    try {
      // Required lazily: this native module isn't available on web and
      // throws at import time if loaded statically there.
      const ImagePicker = require('expo-image-picker');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to add a photo to your scorecard.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 32],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open your photo library. Please try again.');
    }
  }

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
            <View style={styles.cardRow}>
              <View style={styles.leftCol}>
                <View>
                  <Text style={styles.userName}>{fullName}</Text>
                </View>

                <View style={styles.scoresRow}>
                  <NineColumn holes={scorecard.front} label="FRONT" />
                  {!isNineHoleRound && <NineColumn holes={scorecard.back} label="BACK" />}
                </View>

                <View style={styles.bottomSpacer} />

                <View style={styles.bottomBlock}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalScore}>{totalScore}</Text>
                    <Text style={[styles.totalDiff, { color: diffColor(diff) }]}>
                      ({diffLabel})
                    </Text>
                  </View>

                  <Text style={styles.tournamentLabel}>TOURNAMENT</Text>
                  <Text
                    style={[
                      styles.tournamentScore,
                      { color: diffColor(scorecard.tournamentScore.startsWith('-') ? -1 : scorecard.tournamentScore.startsWith('+') ? 1 : 0) },
                    ]}
                  >
                    {scorecard.tournamentScore}
                  </Text>

                  <Text style={styles.watermarkText}>SaveitGolf</Text>
                </View>
              </View>

              <PhotoBox uri={photoUri} onPress={handlePickPhoto} />
            </View>
          </ViewShot>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            disabled={isSharing}
            activeOpacity={0.8}
          >
            <Ionicons name="share-outline" size={16} color={colors.white} />
            <Text style={styles.shareButtonText}>{isSharing ? 'Saving…' : 'Share'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.circleRing}>
              <Text style={styles.legendGlyph}>3</Text>
            </View>
            <Text style={styles.legendText}>Birdie</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.circleRing}>
              <View style={styles.circleRing}>
                <Text style={styles.legendGlyph}>2</Text>
              </View>
            </View>
            <Text style={styles.legendText}>Eagle</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.squareRing}>
              <Text style={styles.legendGlyph}>5</Text>
            </View>
            <Text style={styles.legendText}>Bogey</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.squareRing}>
              <View style={styles.squareRing}>
                <Text style={styles.legendGlyph}>6</Text>
              </View>
            </View>
            <Text style={styles.legendText}>Double Bogey</Text>
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
    backgroundColor: colors.navy,
    aspectRatio: 9 / 16,
    width: '100%',
    overflow: 'hidden',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
  },
  leftCol: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  userName: {
    color: colors.white,
    fontSize: 21,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  columnTotalBlock: {
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
    marginTop: 6,
    paddingTop: 6,
  },
  columnTotalText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  columnTotalLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  bottomSpacer: {
    flex: 1,
  },
  bottomBlock: {
    alignItems: 'flex-start',
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
  tournamentLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 10,
  },
  tournamentScore: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  watermarkText: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 13,
    color: colors.muted,
    opacity: 0.85,
    marginTop: 14,
  },
  photoBox: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.navyLight,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  photoPlaceholderText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  shareButton: {
    position: 'absolute',
    bottom: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
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
