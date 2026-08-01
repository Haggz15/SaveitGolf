import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard, { NineColumn, GrandTotal, computeTotals } from '../components/scorecard/ScorecardCard';
import colors from '../theme/colors';
import { scorecard as mockScorecard, currentUser } from '../data/mockData';
import { getLatestScorecard, saveScorecard } from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;

export default function ScorecardScreen() {
  const { user, profile } = useAuth();
  const viewShotRef = useRef(null);
  const exportViewShotRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [activeScorecard, setActiveScorecard] = useState(mockScorecard);
  const [modalVisible, setModalVisible] = useState(false);
  const [pastListKey, setPastListKey] = useState(0);
  const [detailScorecard, setDetailScorecard] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      try {
        const latest = await getLatestScorecard(user.id);
        if (latest) setActiveScorecard(latest);
      } catch (err) {
        console.error('Failed to load latest scorecard:', err);
      }
    })();
  }, [user?.id]);

  const { isNineHoleRound, totalScore, diffLabel, diff } = computeTotals(activeScorecard);
  const fullName = `${currentUser.firstName} ${currentUser.lastName}`.toUpperCase();

  async function handleScorecardSaved(newScorecard) {
    if (!user?.id) return;
    try {
      const saved = await saveScorecard(user.id, newScorecard);
      setActiveScorecard(saved);
      setPhotoUri(null);
      setModalVisible(false);
      // Refresh the Past Scorecards list so the round just logged shows up.
      setPastListKey((k) => k + 1);
      notifyFollowersOfScorecard(user.id, saved.id, saved.courseName).catch((err) =>
        console.error('Failed to notify followers of scorecard:', err)
      );
    } catch (err) {
      console.error('Failed to save scorecard:', err);
      Alert.alert('Something went wrong', 'Could not save your scorecard. Please try again.');
    }
  }

  async function handlePickPhoto() {
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
        aspect: [9, 16],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open your photo library. Please try again.');
    }
  }

  function handleUseProfilePhoto() {
    if (!profile?.avatar_url) return;
    setPhotoUri(profile.avatar_url);
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

      // With a photo attached, share the two-column 1080x1920 story image
      // instead of the compact on-screen card.
      const uri = photoUri
        ? await exportViewShotRef.current.capture()
        : await viewShotRef.current.capture();

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

  const photoSlot = (
    <TouchableOpacity style={styles.photoInlineBox} onPress={handlePickPhoto} activeOpacity={0.8}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={styles.photoInlineImage} resizeMode="cover" />
      ) : (
        <>
          <Ionicons name="camera-outline" size={18} color={colors.muted} />
          <Text style={styles.photoInlineText}>Add{'\n'}Photo</Text>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.newScorecardButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.newScorecardButtonText}>New Scorecard</Text>
        </TouchableOpacity>

        <View style={styles.cardWrapper}>
          <ViewShot
            ref={viewShotRef}
            style={styles.card}
            options={{ format: 'png', quality: 1 }}
          >
            <ScorecardCard scorecard={activeScorecard} fullName={fullName} photoSlot={photoSlot} />
          </ViewShot>

          {profile?.avatar_url && !photoUri && (
            <TouchableOpacity onPress={handleUseProfilePhoto} style={styles.useProfilePhotoLink}>
              <Text style={styles.useProfilePhotoText}>Use my profile photo instead</Text>
            </TouchableOpacity>
          )}

          <View style={styles.actionRow}>
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

        <View style={styles.pastSection}>
          <Text style={styles.pastSectionTitle}>Past Scorecards</Text>
          {user?.id && (
            <PastScorecardsList key={pastListKey} userId={user.id} onSelect={setDetailScorecard} />
          )}
        </View>
      </ScrollView>

      {/* Hidden off-screen template captured for the shared story image only
          — kept at a fixed 9:16 box and resized to exactly 1080x1920 by
          ViewShot's capture options, independent of on-screen layout. */}
      {photoUri && (
        <View style={styles.exportOffscreenWrap} pointerEvents="none">
          <ViewShot
            ref={exportViewShotRef}
            style={styles.exportCard}
            options={{ format: 'png', quality: 1, width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
          >
            <View style={styles.exportRow}>
              <View style={styles.exportLeftCol}>
                <Text style={styles.userName}>{fullName}</Text>
                <Text style={styles.courseNameText} numberOfLines={2}>
                  {activeScorecard.courseName}
                </Text>

                <View style={styles.scoresRow}>
                  <NineColumn holes={activeScorecard.front} totalLabel="FRONT" />
                  {!isNineHoleRound && <NineColumn holes={activeScorecard.back} totalLabel="BACK" />}
                </View>

                <GrandTotal totalScore={totalScore} diffLabel={diffLabel} diff={diff} />
              </View>

              <View style={styles.exportPhotoBox}>
                <Image source={{ uri: photoUri }} style={styles.photoImage} resizeMode="cover" />
              </View>
            </View>

            <View style={styles.watermarkWrap}>
              <Text style={styles.watermarkText}>SaveitGolf</Text>
            </View>
          </ViewShot>
        </View>
      )}

      <NewScorecardModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSaved={handleScorecardSaved}
        fullName={fullName}
      />

      <ScorecardDetailModal
        visible={Boolean(detailScorecard)}
        scorecard={detailScorecard}
        fullName={fullName}
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  newScorecardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  newScorecardButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  cardWrapper: {
    position: 'relative',
  },
  card: {
    backgroundColor: colors.navy,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  photoInlineBox: {
    width: 64,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoInlineImage: {
    width: '100%',
    height: '100%',
  },
  photoInlineText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 11,
  },
  useProfilePhotoLink: {
    alignItems: 'center',
    marginTop: 10,
  },
  useProfilePhotoText: {
    color: colors.blue,
    fontSize: 13,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 14,
  },
  shareButton: {
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
  pastSection: {
    marginTop: 28,
  },
  pastSectionTitle: {
    fontFamily: 'Cinzel_700Bold',
    color: colors.white,
    fontSize: 16,
    marginBottom: 12,
  },
  // Export-only (1080x1920 share image) styles below.
  exportOffscreenWrap: {
    position: 'absolute',
    top: 0,
    left: -3000,
  },
  exportCard: {
    width: 337.5,
    height: 600,
    backgroundColor: colors.navy,
    overflow: 'hidden',
  },
  exportRow: {
    flex: 1,
    flexDirection: 'row',
  },
  exportLeftCol: {
    flex: 1,
    paddingTop: 22,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  exportPhotoBox: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.navyLight,
  },
  photoImage: {
    width: '100%',
    height: '100%',
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
