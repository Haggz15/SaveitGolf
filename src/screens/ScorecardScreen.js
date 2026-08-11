import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard from '../components/scorecard/ScorecardCard';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { scorecard as mockScorecard } from '../data/mockData';
import { getLatestScorecard, saveScorecard } from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';

export default function ScorecardScreen() {
  const { user, profile } = useAuth();
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  // True while the web share capture is in flight — hides the New
  // Scorecard button and the Add Photo (+) button so neither ends up in
  // the captured image, then both reappear once capture finishes.
  const [capturing, setCapturing] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
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

  // `photoUri` is the single source of truth for what the card displays —
  // keep it in sync whenever the active scorecard changes (initial load,
  // fetched latest, or just-saved), so removing a photo always works even
  // when it came from a saved scorecard rather than a fresh pick.
  useEffect(() => {
    setPhotoUri(activeScorecard.photoUrl ?? null);
  }, [activeScorecard]);

  const fullName = (profile?.full_name || 'Unnamed Golfer').toUpperCase();

  async function handleScorecardSaved(newScorecard) {
    if (!user?.id) return;
    try {
      const saved = await saveScorecard(user.id, { ...newScorecard, photoUri });
      setActiveScorecard(saved);
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
      setPhotoUri(URL.createObjectURL(file));
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotoUri(result.assets[0].uri);
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
      try {
        setIsSharing(true);
        setCapturing(true);
        // Let the hide re-render actually commit to the DOM before reading
        // it — otherwise html2canvas can grab a frame from just before the
        // buttons disappear.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // Required lazily: a browser-DOM library, not meaningful (and not
        // necessarily safe to even load) on native.
        const html2canvas = require('html2canvas');
        const node = document.getElementById('scorecard-card');
        const canvas = await html2canvas(node, { backgroundColor: null, useCORS: true });
        const dataUrl = canvas.toDataURL('image/png');

        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'SaveitGolf-Scorecard.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Not the browser's native window.alert() — that's a blocking modal
        // dialog (freezes the tab until dismissed), which is a worse
        // experience here than the same non-blocking Toast the native path
        // below already uses for its own success message.
        setToastMessage({ text: 'Scorecard saved to Downloads', type: 'success' });
      } catch (err) {
        Alert.alert('Something went wrong', 'Could not export your scorecard. Please try again.');
      } finally {
        setCapturing(false);
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

      const uri = await shareCardRef.current.capture();

      await MediaLibrary.saveToLibraryAsync(uri);
      setToastMessage({ text: 'Scorecard saved to Camera Roll', type: 'success' });
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
        {!capturing && (
          <TouchableOpacity
            style={styles.newScorecardButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="add-circle" size={20} color={colors.white} />
            <Text style={styles.newScorecardButtonText}>New Scorecard</Text>
          </TouchableOpacity>
        )}

        <View style={styles.cardWrapper}>
          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
            <ScorecardCard
              scorecard={activeScorecard}
              fullName={fullName}
              photoUri={photoUri}
              onRequestPhoto={handlePickPhoto}
              onRemovePhoto={() => setPhotoUri(null)}
              captureId="scorecard-card"
            />
          </ViewShot>

          <View style={styles.topRightButtons}>
            {!photoUri && !capturing && (
              <TouchableOpacity
                onPress={handlePickPhoto}
                style={styles.addPhotoPlusButton}
                activeOpacity={0.85}
              >
                <Text style={styles.addPhotoPlusButtonText}>+</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              disabled={isSharing}
              activeOpacity={0.8}
            >
              <Ionicons name="share-outline" size={13} color={colors.white} />
              <Text style={styles.shareButtonText}>{isSharing ? 'Saving…' : 'Share'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.pastSection}>
          <Text style={styles.pastSectionTitle}>Past Scorecards</Text>
          {user?.id && (
            <PastScorecardsList key={pastListKey} userId={user.id} onSelect={setDetailScorecard} />
          )}
        </View>
      </ScrollView>

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

      <Toast
        message={toastMessage?.text}
        type={toastMessage?.type}
        onHide={() => setToastMessage(null)}
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
    position: 'relative',
  },
  // Overlaid on top of the card (a sibling of the ViewShot-wrapped content,
  // not a child of it) so neither button ever shows up in the
  // captured/saved image.
  topRightButtons: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // Only rendered when there's no photo yet; tapping it opens the picker.
  // Disappears (and the card's own "Remove" button takes over) once a
  // photo is set.
  addPhotoPlusButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brightGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoPlusButtonText: {
    color: '#0d2a0d',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.red,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  shareButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
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
});
