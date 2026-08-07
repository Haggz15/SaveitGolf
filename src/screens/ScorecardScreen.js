import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard, { computeTotals } from '../components/scorecard/ScorecardCard';
import {
  NameSection,
  ExportNineColumn,
  ExportGrandTotal,
  BallWatermark,
  PillWatermark,
} from '../components/scorecard/ScorecardExportCard';
import PhotoCropBox from '../components/scorecard/PhotoCropBox';
import CroppedPhoto from '../components/scorecard/CroppedPhoto';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { scorecard as mockScorecard } from '../data/mockData';
import { getLatestScorecard, saveScorecard } from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';

// Exported bitmap size for both share cards (a 9:16 "story" format). Both
// hidden ViewShot templates below are laid out at 1/3.2 of this (337.5x600)
// and captured up to the full size, so every font/spacing number in
// ScorecardExportCard.js can be read as the actual on-screen-at-natural-scale
// value rather than something pre-scaled for the final bitmap.
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1920;
const EXPORT_SCALE = 3.2;
const EXPORT_NATURAL_WIDTH = EXPORT_WIDTH / EXPORT_SCALE;
const EXPORT_NATURAL_HEIGHT = EXPORT_HEIGHT / EXPORT_SCALE;
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
  const [toastMessage, setToastMessage] = useState(null);

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

      // Required lazily: this native module isn't available on web and
      // throws at import time if loaded statically there.
      const MediaLibrary = require('expo-media-library');

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access in Settings.');
        return;
      }

      const uri = photo ? await photoViewShotRef.current.capture() : await cleanViewShotRef.current.capture();

      await MediaLibrary.saveToLibraryAsync(uri);
      setToastMessage('Scorecard saved to Camera Roll');
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
          at 1/3.2 natural scale (see EXPORT_SCALE above) and then upscaled by
          ViewShot's capture options to the required 1080x1920, so every
          font/spacing value in ScorecardExportCard.js reads as its literal
          natural-scale number. */}
      <View style={styles.exportOffscreenWrap} pointerEvents="none">
        <ViewShot
          ref={cleanViewShotRef}
          style={styles.cleanExportCard}
          options={{ format: 'png', quality: 1, width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
        >
          <NameSection fullName={fullName} courseName={activeScorecard.courseName} />

          <View style={styles.cleanScoresRow}>
            <ExportNineColumn holes={activeScorecard.front} label="FRONT" style={styles.cleanNineColumn} />
            {!isNineHoleRound && (
              <ExportNineColumn holes={activeScorecard.back} label="BACK" style={styles.cleanNineColumn} />
            )}
          </View>

          <ExportGrandTotal
            totalScore={totalScore}
            diffLabel={diffLabel}
            diff={diff}
            style={styles.cleanTotalBlock}
          >
            <BallWatermark style={styles.cleanWatermark} />
          </ExportGrandTotal>
        </ViewShot>

        {photo && (
          <ViewShot
            ref={photoViewShotRef}
            style={styles.photoExportCard}
            options={{ format: 'png', quality: 1, width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
          >
            <View style={styles.photoRow}>
              <View style={styles.photoScoreCol}>
                <View style={styles.photoScoresRow}>
                  <ExportNineColumn holes={activeScorecard.front} label="FRONT" style={styles.photoNineColumn} />
                  {!isNineHoleRound && (
                    <ExportNineColumn holes={activeScorecard.back} label="BACK" style={styles.photoNineColumn} />
                  )}
                </View>

                <ExportGrandTotal
                  totalScore={totalScore}
                  diffLabel={diffLabel}
                  diff={diff}
                  style={styles.photoTotalBlock}
                />
              </View>

              <View style={styles.photoHalf}>
                <CroppedPhoto photo={photo} crop={crop} />
                <View style={styles.photoPillWatermarkWrap} pointerEvents="none">
                  <PillWatermark />
                </View>
              </View>
            </View>

            {/* Name banner: overlaid on top of both the scores and the photo,
                full card width, with a dark gradient behind it so the name
                reads over a bright photo. */}
            <LinearGradient
              colors={['rgba(0,0,0,0.82)', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0)']}
              style={styles.photoNameBannerGradient}
              pointerEvents="none"
            />
            <NameSection
              fullName={fullName}
              courseName={activeScorecard.courseName}
              style={styles.photoNameBanner}
            />
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

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
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
  // Export-only styles below — laid out at 1/EXPORT_SCALE natural size (see
  // the constant above) and upscaled to 1080x1920 by ViewShot's capture
  // options, so every number here is the literal natural-scale value rather
  // than something pre-scaled for the final bitmap.
  exportOffscreenWrap: {
    position: 'absolute',
    top: 0,
    left: -3000,
  },
  cleanExportCard: {
    width: EXPORT_NATURAL_WIDTH,
    height: EXPORT_NATURAL_HEIGHT,
    backgroundColor: colors.navy,
    paddingTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  cleanScoresRow: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
  },
  cleanNineColumn: {
    width: 70,
  },
  cleanTotalBlock: {
    paddingBottom: 26,
  },
  cleanWatermark: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  photoExportCard: {
    width: EXPORT_NATURAL_WIDTH,
    height: EXPORT_NATURAL_HEIGHT,
    backgroundColor: colors.navy,
    overflow: 'hidden',
    position: 'relative',
  },
  photoRow: {
    flex: 1,
    flexDirection: 'row',
  },
  photoScoreCol: {
    width: '55%',
    paddingTop: 78,
    paddingHorizontal: 14,
    paddingBottom: 16,
    justifyContent: 'space-between',
  },
  photoScoresRow: {
    flexDirection: 'row',
    gap: 10,
  },
  photoNineColumn: {
    flex: 1,
  },
  photoTotalBlock: {
    marginTop: 10,
  },
  photoHalf: {
    width: '45%',
    height: '100%',
    backgroundColor: colors.navyLight,
  },
  photoPillWatermarkWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 10,
    alignItems: 'center',
  },
  photoNameBannerGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 96,
  },
  photoNameBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
});
