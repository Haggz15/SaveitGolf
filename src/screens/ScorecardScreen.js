import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard from '../components/scorecard/ScorecardCard';
import ShareOptionsModal from '../components/scorecard/ShareOptionsModal';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { scorecard as mockScorecard } from '../data/mockData';
import { getLatestScorecard, saveScorecard, saveScorecardPhoto } from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';

export default function ScorecardScreen() {
  const { user, profile } = useAuth();
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  // True while a share capture is in flight (native or web) — hides the New
  // Scorecard button (outside the card) and the card's own green plus /
  // revert arrow (inside it, Fix 2/3) so none of them end up in the
  // captured image, then all reappear once capture finishes.
  const [hideShareExtras, setHideShareExtras] = useState(false);
  // Native only: the freshly-captured scorecard PNG, and whether the
  // TikTok/Instagram/Save/More sheet built on top of it is open.
  const [shareImageUri, setShareImageUri] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  // True once the green plus has switched the card over to the photo-column
  // layout — independent of `photoUri`, since the column shows a tappable
  // placeholder there until a photo is actually picked.
  const [showPhotoColumn, setShowPhotoColumn] = useState(false);
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

  // The card always opens in the no-photo layout, even when the active
  // scorecard already has a saved photo_url (Fix 1) — `photoUri` only gets
  // set once the user taps the green plus. Reset it back to null whenever a
  // *different* scorecard becomes active (initial load, fetched latest, or
  // just-saved) — keyed on id rather than the object itself so it doesn't
  // clobber a reveal/upload the user just triggered on this same scorecard.
  useEffect(() => {
    setPhotoUri(null);
    setShowPhotoColumn(false);
  }, [activeScorecard.id]);

  const fullName = (profile?.full_name || 'Unnamed Golfer').toUpperCase();

  async function handleScorecardSaved(newScorecard) {
    if (!user?.id) return;
    try {
      const saved = await saveScorecard(user.id, newScorecard);
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

  // Displays the picked photo immediately, then — if the active scorecard is
  // a real saved row rather than the placeholder demo card — uploads it to
  // the `scorecards` storage bucket and swaps in the resulting public URL,
  // so it survives a refresh and future visits to this screen (Fix 4).
  async function applyPickedPhoto(uri) {
    setPhotoUri(uri);
    if (!user?.id || !activeScorecard.id) return;
    try {
      const uploadedUrl = await saveScorecardPhoto(user.id, activeScorecard.id, uri);
      setActiveScorecard((prev) => ({ ...prev, photoUrl: uploadedUrl }));
      setPhotoUri(uploadedUrl);
    } catch (err) {
      console.error('Failed to save scorecard photo:', err);
      Alert.alert('Something went wrong', 'Could not save your photo. Please try again.');
    }
  }

  function handlePickPhotoWeb() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      applyPickedPhoto(URL.createObjectURL(file));
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
        applyPickedPhoto(result.assets[0].uri);
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

  // The green plus beside the totals row (Fix 2): reveals an already-saved
  // photo instead of re-uploading it when one exists, otherwise just
  // switches the layout over to the photo column, which shows a tappable
  // placeholder (see PhotoColumn in ScorecardCard) until the user actually
  // picks a photo.
  function handleAddPhotoPress() {
    if (activeScorecard.photoUrl) {
      setPhotoUri(activeScorecard.photoUrl);
    } else {
      setShowPhotoColumn(true);
    }
  }

  async function handleShare() {
    if (Platform.OS === 'web') {
      try {
        setIsSharing(true);
        setHideShareExtras(true);
        // Let the hide re-render actually commit to the DOM before reading
        // it — otherwise html2canvas can grab a frame from just before the
        // buttons disappear.
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

        // Required lazily: a browser-DOM library, not meaningful (and not
        // necessarily safe to even load) on native.
        const html2canvas = require('html2canvas');
        const node = document.getElementById('scorecard-card');
        const canvas = await html2canvas(node, {
          backgroundColor: colors.navy,
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
        });
        setHideShareExtras(false);

        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'SaveitGolf-Scorecard.png';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          setIsSharing(false);

          // Not the browser's native window.alert() — that's a blocking
          // modal dialog (freezes the tab until dismissed), which is a
          // worse experience here than the same non-blocking Toast the
          // native path below already uses for its own success message.
          setToastMessage({ text: 'Scorecard saved to Downloads', type: 'success' });
        }, 'image/png', 1.0);
      } catch (err) {
        setHideShareExtras(false);
        setIsSharing(false);
        Alert.alert('Something went wrong', 'Could not export your scorecard. Please try again.');
      }
      return;
    }

    try {
      setIsSharing(true);
      const uri = await captureScorecard();
      setShareImageUri(uri);
      setShowShareModal(true);
    } catch (err) {
      console.error('Capture error:', err);
      Alert.alert('Something went wrong', 'Could not capture your scorecard. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  // Native only. The green plus and revert arrow live inside the ViewShot-
  // captured subtree, so they need hiding for the duration of the capture
  // just like the web html2canvas path above — the short delay after
  // hiding them lets that re-render actually commit before ViewShot reads
  // the view, otherwise it can grab a frame from just before they disappear.
  async function captureScorecard() {
    setHideShareExtras(true);
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      return await shareCardRef.current.capture();
    } finally {
      setHideShareExtras(false);
    }
  }

  async function handleSaveToPhotos() {
    try {
      // Required lazily: this native module isn't available on web and
      // throws at import time if loaded statically there.
      const MediaLibrary = require('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo access in Settings.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(shareImageUri);
      setShowShareModal(false);
      setToastMessage({ text: 'Scorecard saved to Camera Roll', type: 'success' });
    } catch (err) {
      console.error('Save error:', err);
      Alert.alert('Something went wrong', 'Could not save your scorecard. Please try again.');
    }
  }

  // TikTok doesn't let external apps inject content directly into its
  // composer, so the best available flow is: save the image to the camera
  // roll first, then open TikTok and let the user pick it from Photos.
  async function handleShareTikTok() {
    try {
      const MediaLibrary = require('expo-media-library');
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(shareImageUri);
      }
      setShowShareModal(false);
      await new Promise((resolve) => setTimeout(resolve, 500));

      const canOpen = await Linking.canOpenURL('tiktok://');
      if (!canOpen) {
        Alert.alert('TikTok not installed', 'Please install TikTok to share there.');
        return;
      }
      await Linking.openURL('tiktok://');
      Alert.alert(
        'TikTok Opened',
        'Your scorecard has been saved to your Camera Roll. In TikTok tap + then select the scorecard from your photos to post.',
        [{ text: 'Got it' }]
      );
    } catch (err) {
      console.error('TikTok share error:', err);
      Alert.alert('Something went wrong', 'Could not open TikTok. Please try again.');
    }
  }

  // Instagram Stories' deep link, unlike TikTok's, can pre-load the image
  // straight into the composer — it just needs the file at a stable path
  // first, since the ViewShot capture uri can be a transient cache file.
  async function handleShareInstagram() {
    try {
      const FileSystem = require('expo-file-system');
      const destPath = `${FileSystem.cacheDirectory}SaveitGolf-Scorecard.png`;
      await FileSystem.copyAsync({ from: shareImageUri, to: destPath });
      setShowShareModal(false);
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canOpenStories = await Linking.canOpenURL('instagram-stories://share');
      if (canOpenStories) {
        await Linking.openURL(`instagram-stories://share?backgroundImage=${encodeURIComponent(destPath)}`);
        return;
      }

      // Fallback for when Instagram is installed but doesn't answer the
      // Stories scheme (or isn't installed at all) — the plain iOS share
      // sheet still lets the user pick Instagram manually.
      const Sharing = require('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(destPath, { mimeType: 'image/png', dialogTitle: 'Share Scorecard to Instagram' });
      } else {
        Alert.alert('Instagram not installed', 'Please install Instagram to share there.');
      }
    } catch (err) {
      console.error('Instagram share error:', err);
      Alert.alert('Something went wrong', 'Could not share to Instagram. Please try again.');
    }
  }

  async function handleShareMore() {
    try {
      setShowShareModal(false);
      await new Promise((resolve) => setTimeout(resolve, 300));
      const Sharing = require('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(shareImageUri, { mimeType: 'image/png', dialogTitle: 'Share your SaveitGolf Scorecard' });
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  }

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!hideShareExtras && (
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
              onRemovePhoto={() => {
                setPhotoUri(null);
                setShowPhotoColumn(false);
              }}
              onAddPhoto={handleAddPhotoPress}
              showPhotoColumn={showPhotoColumn}
              hideShareExtras={hideShareExtras}
              captureId="scorecard-card"
            />
          </ViewShot>

          <View style={styles.topRightButtons}>
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

      <ShareOptionsModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShareTikTok={handleShareTikTok}
        onShareInstagram={handleShareInstagram}
        onSaveToPhotos={handleSaveToPhotos}
        onShareMore={handleShareMore}
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
  // not a child of it) so it never shows up in the captured/saved image.
  topRightButtons: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
