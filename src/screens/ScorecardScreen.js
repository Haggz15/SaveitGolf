import { useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import colors from '../theme/colors';
import { scorecard, currentUser } from '../data/mockData';

const serifFont = Platform.select({
  ios: 'Rockwell',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

function sumPar(holes) {
  return holes.reduce((sum, h) => sum + h.par, 0);
}

function sumScore(holes) {
  return holes.reduce((sum, h) => sum + h.score, 0);
}

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

function NineColumn({ title, holes, totalLabel }) {
  const totalPar = sumPar(holes);
  const totalScore = sumScore(holes);

  return (
    <View style={styles.column}>
      <Text style={styles.columnTitle}>{title}</Text>

      <View style={styles.columnHeaderRow}>
        <Text style={styles.columnHeaderCell}>Par</Text>
        <Text style={styles.columnHeaderCell}>Score</Text>
      </View>

      {holes.map((h) => (
        <View key={h.hole} style={styles.columnRow}>
          <Text style={styles.columnCell}>{h.par}</Text>
          <View style={styles.columnCell}>
            <ScoreBadge score={h.score} par={h.par} />
          </View>
        </View>
      ))}

      <View style={[styles.columnRow, styles.columnTotalRow]}>
        <Text style={[styles.columnCell, styles.columnTotalText]}>{totalPar}</Text>
        <Text style={[styles.columnCell, styles.columnTotalText]}>{totalScore}</Text>
      </View>
      <Text style={styles.columnTotalLabel}>{totalLabel}</Text>
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
          <Ionicons name="camera-outline" size={26} color={colors.muted} />
          <Text style={styles.photoPlaceholderText}>Add photo</Text>
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
        aspect: [3, 5],
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
            <View style={styles.cardHeader}>
              <Text style={styles.userName}>{fullName}</Text>
              <Text style={styles.playedCourseName}>{scorecard.courseName}</Text>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.columns}>
                <NineColumn title="Front 9" holes={scorecard.front} totalLabel="OUT" />
                {!isNineHoleRound && (
                  <NineColumn title="Back 9" holes={scorecard.back} totalLabel="IN" />
                )}
              </View>

              <PhotoBox uri={photoUri} onPress={handlePickPhoto} />
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
    marginBottom: 16,
  },
  userName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  playedCourseName: {
    color: colors.white,
    fontSize: 14,
    marginTop: 3,
    opacity: 0.9,
    fontFamily: serifFont,
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
  cardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  columns: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
  },
  column: {
    flex: 1,
  },
  columnTitle: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 6,
  },
  columnHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingBottom: 4,
    marginBottom: 2,
  },
  columnHeaderCell: {
    flex: 1,
    color: colors.muted,
    fontSize: 9,
    textAlign: 'center',
    fontWeight: '600',
  },
  columnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  columnCell: {
    flex: 1,
    color: colors.offWhite,
    fontSize: 12,
    textAlign: 'center',
    alignItems: 'center',
  },
  scoreBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    minWidth: 14,
    textAlign: 'center',
  },
  circleRing: {
    borderWidth: 1.3,
    borderColor: colors.green,
    borderRadius: 999,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  squareRing: {
    borderWidth: 1.3,
    borderColor: colors.red,
    borderRadius: 3,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTotalRow: {
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
    marginTop: 4,
    paddingTop: 5,
  },
  columnTotalText: {
    color: colors.white,
    fontWeight: '700',
  },
  columnTotalLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  photoBox: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.navyLight,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    minHeight: 150,
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
    fontSize: 11,
    fontWeight: '600',
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
    color: colors.green,
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
