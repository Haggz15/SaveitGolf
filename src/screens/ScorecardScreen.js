import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard, { NineColumn, GrandTotal, computeTotals } from '../components/scorecard/ScorecardCard';
import PhotoCropBox from '../components/scorecard/PhotoCropBox';
import CroppedPhoto from '../components/scorecard/CroppedPhoto';
import colors from '../theme/colors';
import { scorecard as mockScorecard } from '../data/mockData';
import { getLatestScorecard, saveScorecard } from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';

const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;
const DEFAULT_CROP = { zoom: 1, panX: 0.5, panY: 0.5 };

export default function ScorecardScreen() {
  const { user, profile } = useAuth();
  const cleanViewShotRef = useRef(null);
  const photoViewShotRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [photo, setPhoto] = useState(null); // { uri, width, height }
  const [crop, setCrop] = useState(DEFAULT_CROP);
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
  const fullName = (profile?.full_name || 'Unnamed Golfer').toUpperCase();

  async function handleScorecardSaved(newScorecard) {
    if (!user?.id) return;
    try {
      const saved = await saveScorecard(user.id, newScorecard);
      setActiveScorecard(saved);
      setPhoto(null);
      setCrop(DEFAULT_CROP);
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

  function handlePickPhotoWeb() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const uri = URL.createObjectURL(file);
      const img = new window.Image();
      img.onload = () => {
        setPhoto({ uri, width: img.naturalWidth, height: img.naturalHeight });
        setCrop(DEFAULT_CROP);
      };
      img.src = uri;
    };
    input.click();
  }

  async function handlePickPhotoNative() {
    try {
      // Required lazily: this native module isn't available on web and
      // throws at import time if loaded statically there.
      const ImagePicker = require('expo-image-picker');

      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow photo library access to add a photo to your scorecard.');
        return;
      }

      // No allowsEditing here — cropping/panning happens in-place afterward
      // via PhotoCropBox so the same crop can be reproduced in the export.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.9,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
        setCrop(DEFAULT_CROP);
      }
    } catch (err) {
      Alert.alert('Something went wrong', 'Could not open your photo library. Please try again.');
    }
  }

  function handlePickPhoto() {
    if (Platform.OS === 'web') {
      handlePickPhotoWeb();
    } else {
      handlePickPhotoNative();
    }
  }

  async function handleShare() {
    if (Platform.OS === 'web') {
      const ref = photo ? photoViewShotRef.current : cleanViewShotRef.current;
      try {
        setIsSharing(true);
        const dataUrl = await ref.capture();
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${activeScorecard.courseName || 'scorecard'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        Alert.alert('Something went wrong', 'Could not export your scorecard. Please try again.');
      } finally {
        setIsSharing(false);
      }
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

      const uri = photo ? await photoViewShotRef.current.capture() : await cleanViewShotRef.current.capture();

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
    <PhotoCropBox photo={photo} crop={crop} onCropChange={setCrop} onRequestPhoto={handlePickPhoto} />
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
          <ScorecardCard
            scorecard={activeScorecard}
            fullName={fullName}
            photoSlot={photoSlot}
            onShare={handleShare}
            sharing={isSharing}
          />
        </View>

        <View style={styles.pastSection}>
          <Text style={styles.pastSectionTitle}>Past Scorecards</Text>
          {user?.id && (
            <PastScorecardsList key={pastListKey} userId={user.id} onSelect={setDetailScorecard} />
          )}
        </View>
      </ScrollView>

      {/* Hidden off-screen templates captured for sharing. Both are laid out
          at on-screen scale (matching ScorecardCard's own text sizes) and
          then resized by ViewShot's capture options — the clean card to its
          natural size, the with-photo card up to the required 1080x1920 —
          so nothing needs re-tuning font sizes per export target. */}
      <View style={styles.exportOffscreenWrap} pointerEvents="none">
        <ViewShot ref={cleanViewShotRef} style={styles.cleanExportCard} options={{ format: 'png', quality: 1 }}>
          <Text style={styles.userName}>{fullName}</Text>
          <Text style={styles.courseNameText} numberOfLines={2}>
            {activeScorecard.courseName}
          </Text>

          <View style={styles.scoresRow}>
            <NineColumn holes={activeScorecard.front} label="FRONT" />
            {!isNineHoleRound && <NineColumn holes={activeScorecard.back} label="BACK" />}
          </View>

          <GrandTotal totalScore={totalScore} diffLabel={diffLabel} diff={diff} />

          <View style={styles.watermarkWrap}>
            <Text style={styles.watermarkText}>SaveitGolf</Text>
          </View>
        </ViewShot>

        {photo && (
          <ViewShot
            ref={photoViewShotRef}
            style={styles.photoExportCard}
            options={{ format: 'png', quality: 1, width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
          >
            <View style={styles.exportRow}>
              <View style={styles.exportLeftCol}>
                <Text style={styles.userName}>{fullName}</Text>
                <Text style={styles.courseNameText} numberOfLines={2}>
                  {activeScorecard.courseName}
                </Text>

                <View style={styles.scoresRow}>
                  <NineColumn holes={activeScorecard.front} label="FRONT" />
                  {!isNineHoleRound && <NineColumn holes={activeScorecard.back} label="BACK" />}
                </View>

                <GrandTotal totalScore={totalScore} diffLabel={diffLabel} diff={diff} />
              </View>

              <View style={styles.exportPhotoHalf}>
                <CroppedPhoto photo={photo} crop={crop} />
              </View>
            </View>

            <View style={styles.watermarkWrap}>
              <Text style={styles.watermarkText}>SaveitGolf</Text>
            </View>
          </ViewShot>
        )}
      </View>

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
    backgroundColor: colors.navy,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.navyBorder,
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
  // Export-only styles below — deliberately at the same scale as
  // ScorecardCard's own on-screen text. ViewShot resizes the captured
  // bitmap to each template's target dimensions (natural size for the clean
  // card, 1080x1920 for the with-photo card), so a uniform image upscale
  // handles the rest without needing separately-tuned font sizes.
  exportOffscreenWrap: {
    position: 'absolute',
    top: 0,
    left: -3000,
  },
  cleanExportCard: {
    width: 380,
    backgroundColor: colors.navy,
    paddingTop: 22,
    paddingHorizontal: 18,
    paddingBottom: 40,
    position: 'relative',
  },
  photoExportCard: {
    width: 337.5,
    height: 600,
    backgroundColor: colors.navy,
    overflow: 'hidden',
    position: 'relative',
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
  exportPhotoHalf: {
    flex: 1,
    height: '100%',
    backgroundColor: colors.navyLight,
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
    color: colors.lightBlue,
    fontSize: 12,
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
