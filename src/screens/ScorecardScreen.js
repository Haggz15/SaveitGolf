import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import Header from '../components/Header';
import NewScorecardModal from '../components/scorecard/NewScorecardModal';
import PastScorecardsList from '../components/scorecard/PastScorecardsList';
import ScorecardDetailModal from '../components/scorecard/ScorecardDetailModal';
import ScorecardCard from '../components/scorecard/ScorecardCard';
import PhotoLayoutToggle from '../components/scorecard/PhotoLayoutToggle';
import ShareOptionsModal from '../components/scorecard/ShareOptionsModal';
import WebPhotoCropModal from '../components/scorecard/WebPhotoCropModal';
import PhotoCropModal from '../components/scorecard/PhotoCropModal';
import PhotoActionSheet from '../components/scorecard/PhotoActionSheet';
import EditScoreModal from '../components/scorecard/EditScoreModal';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { scorecard as mockScorecard } from '../data/mockData';
import {
  getLatestScorecard,
  saveScorecard,
  saveScorecardPhoto,
  setScorecardPhotoUrl,
  updateScorecardPhotoLayout,
} from '../services/scorecards';
import { notifyFollowersOfScorecard } from '../services/notifications';
import { useAuth } from '../context/AuthContext';
import { compressImage } from '../utils/imageCompression';
import { saveLocalUriToLibrary } from '../utils/saveMedia';

export default function ScorecardScreen() {
  const { user, profile } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  // On iPad the scorecard, buttons, and past-scorecards list would otherwise
  // stretch edge-to-edge across a ~1000pt+ screen — cap the content column
  // and center it like a reading-width form instead.
  const isTablet = Platform.isPad || windowWidth >= 768;
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  // True while a share capture is in flight (native or web) — hides the New
  // Scorecard button (outside the card) and the card's own green plus /
  // revert arrow (inside it, Fix 2/3) so none of them end up in the
  // captured image, then all reappear once capture finishes.
  const [hideShareExtras, setHideShareExtras] = useState(false);
  // Native only: the freshly-captured scorecard PNG, and whether the
  // Save/Share sheet built on top of it is open.
  const [shareImageUri, setShareImageUri] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  // Web only: which part of the photo the `cover`-resized frame centers on
  // (see WebPhotoCropModal) — native bakes crops into the file itself
  // (PhotoCropModal), so this stays at its default center there.
  const [photoPosition, setPhotoPosition] = useState({ x: 50, y: 50 });
  // Web only: the just-picked, not-yet-positioned photo waiting on
  // WebPhotoCropModal, and whether that modal is open.
  const [rawPhotoUri, setRawPhotoUri] = useState(null);
  const [showWebCrop, setShowWebCrop] = useState(false);
  // Web only: true when WebPhotoCropModal is repositioning the photo that's
  // already on the card (tapped) rather than a just-picked one, and the
  // position to restore if that's cancelled.
  const [repositioningWeb, setRepositioningWeb] = useState(false);
  const prevPhotoPositionRef = useRef(photoPosition);
  // Native only: PhotoCropModal, opened from the photo's Crop Photo action.
  const [showCrop, setShowCrop] = useState(false);
  // Change Photo / Crop Photo sheet, opened by tapping the attached photo.
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  // 'side' or 'behind' (Fix 2/5) — which layout ScorecardCard renders the
  // attached photo with. Initialized from whatever the active scorecard has
  // saved, and reset alongside photoUri whenever a different scorecard
  // becomes active (see the effect below).
  const [photoLayout, setPhotoLayout] = useState(mockScorecard.photoLayout || 'behind');
  // True while a just-picked photo is uploading to Supabase storage in the
  // background — the picked photo is already showing locally (see
  // applyPickedPhoto), this just drives a small "Uploading…" indicator so
  // the user knows it hasn't been saved yet.
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Drives the uploadingPill's label while uploadingPhoto is true — flips
  // from 'Optimizing…' to 'Uploading…' partway through applyPickedPhoto.
  const [photoUploadLabel, setPhotoUploadLabel] = useState('Uploading…');
  const [activeScorecard, setActiveScorecard] = useState(mockScorecard);
  const [modalVisible, setModalVisible] = useState(false);
  const [pastListKey, setPastListKey] = useState(0);
  const [detailScorecard, setDetailScorecard] = useState(null);
  const [showEditScore, setShowEditScore] = useState(false);
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

  // The card auto-shows the active scorecard's saved photo_url, if any
  // (Fix 2), rather than hiding it behind the green plus. Reset/reinitialize
  // whenever a *different* scorecard becomes active (initial load, fetched
  // latest, or just-saved) — keyed on id rather than the object itself so it
  // doesn't clobber a photo/upload the user just triggered on this same
  // scorecard.
  useEffect(() => {
    setPhotoUri(activeScorecard.photoUrl || null);
    setPhotoPosition({ x: 50, y: 50 });
    setPhotoLayout(activeScorecard.photoLayout || 'behind');
  }, [activeScorecard.id]);

  const fullName = (profile?.full_name || 'Unnamed Golfer').toUpperCase();

  // A deleted scorecard leaves the Past Scorecards list on its own; this
  // also swaps it off the big card (falling back to the next-latest round)
  // and closes its detail view if that's open.
  async function handleScorecardDeleted(scorecardId) {
    if (detailScorecard?.id === scorecardId) setDetailScorecard(null);
    if (activeScorecard.id !== scorecardId || !user?.id) return;
    try {
      const latest = await getLatestScorecard(user.id);
      setActiveScorecard(latest ?? mockScorecard);
    } catch (err) {
      console.error('Failed to load latest scorecard:', err);
      setActiveScorecard(mockScorecard);
    }
  }

  // Edit Score saved — from the big card or a past scorecard's detail view.
  // Patches the big card if it's the same round and reloads the list so its
  // row shows the new score and +/-.
  function handleScorecardScoreUpdated(updated) {
    setActiveScorecard((prev) =>
      prev.id === updated.id
        ? {
            ...prev,
            manualTotal: updated.manualTotal,
            manualPar: updated.manualPar,
            totalScore: updated.totalScore,
            totalPar: updated.totalPar,
          }
        : prev
    );
    setDetailScorecard((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev));
    setPastListKey((k) => k + 1);
  }

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
  // Displays the picked photo immediately, then — if the active scorecard is
  // a real saved row rather than the placeholder demo card — uploads it to
  // the `scorecards` storage bucket at full quality and swaps in the
  // resulting public URL, so it survives a refresh and future visits to
  // this screen.
  // `crop: true` when `uri` is a crop of the current photo rather than a
  // newly picked one — it then keeps the stored original (see
  // saveScorecardPhoto).
  async function applyPickedPhoto(uri, position = { x: 50, y: 50 }, { crop = false } = {}) {
    // Fix 2: layout always defaults to "behind" the first time a photo is
    // attached to a scorecard, even if a previous photo on this same
    // scorecard had been switched to "side" (that preference goes away with
    // the photo it belonged to).
    const isFirstPhoto = !crop && !activeScorecard.photoUrl;
    setPhotoUri(uri);
    setPhotoPosition(position);
    if (isFirstPhoto) setPhotoLayout('behind');
    if (!user?.id || !activeScorecard.id) return;
    try {
      setUploadingPhoto(true);
      setPhotoUploadLabel('Optimizing…');
      const compressedUri = await compressImage(uri);
      setPhotoUploadLabel('Uploading…');
      const { photoUrl: uploadedUrl, originalPhotoUrl } = await saveScorecardPhoto(
        user.id,
        activeScorecard.id,
        compressedUri,
        { crop, originalPhotoUrl: cropSourceUri }
      );
      setActiveScorecard((prev) => ({
        ...prev,
        photoUrl: uploadedUrl,
        originalPhotoUrl: originalPhotoUrl ?? prev.originalPhotoUrl,
        photoLayout: isFirstPhoto ? 'behind' : prev.photoLayout,
      }));
      setPhotoUri(uploadedUrl);
      if (isFirstPhoto) {
        await updateScorecardPhotoLayout(activeScorecard.id, 'behind').catch((err) =>
          console.error('Failed to save default photo layout:', err)
        );
      }
    } catch (err) {
      console.error('Failed to save scorecard photo:', err);
      Alert.alert('Something went wrong', 'Could not save your photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  // Toggle handler for the Side/Behind pills (Fix 2) — updates the card
  // instantly and persists the choice on the scorecard row (Fix 5) so it's
  // applied automatically the next time this scorecard loads.
  function handlePhotoLayoutChange(layout) {
    setPhotoLayout(layout);
    setActiveScorecard((prev) => ({ ...prev, photoLayout: layout }));
    if (user?.id && activeScorecard.id) {
      updateScorecardPhotoLayout(activeScorecard.id, layout).catch((err) =>
        console.error('Failed to save photo layout:', err)
      );
    }
  }

  // expo-image-picker's allowsEditing (Fix 1's native crop UI) has no web
  // implementation, so the file input's picked photo is routed through
  // WebPhotoCropModal instead of straight to applyPickedPhoto — the user
  // still crops before it lands on the card, same as native, just via a
  // drag-to-position UI rather than the OS one (Fix 5).
  function handlePickPhotoWeb() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setPhotoPosition({ x: 50, y: 50 });
      setRawPhotoUri(URL.createObjectURL(file));
      setShowWebCrop(true);
    };
    document.body.appendChild(input);
    input.click();
  }

  function handleWebCropCancel() {
    setShowWebCrop(false);
    setRawPhotoUri(null);
    if (repositioningWeb) setPhotoPosition(prevPhotoPositionRef.current);
    setRepositioningWeb(false);
  }

  function handleWebCropConfirm() {
    setShowWebCrop(false);
    if (!repositioningWeb) {
      applyPickedPhoto(rawPhotoUri, photoPosition);
    } else if (rawPhotoUri !== photoUri) {
      // Repositioning the original after a native crop: the card goes back
      // to the full original, framed by the new position.
      setPhotoUri(rawPhotoUri);
      setActiveScorecard((prev) => ({ ...prev, photoUrl: rawPhotoUri }));
      if (activeScorecard.id) {
        setScorecardPhotoUrl(activeScorecard.id, rawPhotoUri).catch((err) =>
          console.error('Failed to restore original photo:', err)
        );
      }
    }
    // Otherwise repositioning only moves the frame — nothing to upload.
    setRawPhotoUri(null);
    setRepositioningWeb(false);
  }

  // Every crop starts from the photo as first attached, never from an
  // earlier crop, so the frame can always be widened again.
  const cropSourceUri = activeScorecard.originalPhotoUrl || activeScorecard.photoUrl || photoUri;

  // Tapping the attached photo offers Change Photo / Crop Photo.
  function handlePhotoPress() {
    if (photoUri) setShowPhotoActions(true);
  }

  function handleChangePhotoAction() {
    setShowPhotoActions(false);
    // Let the sheet finish dismissing before the picker presents.
    setTimeout(handlePickPhoto, 350);
  }

  // Crop Photo: a real pixel crop on native (PhotoCropModal, uploaded as
  // the scorecard's crop), and the drag-to-position frame on web, which
  // has no pixel crop.
  function handleCropPhotoAction() {
    setShowPhotoActions(false);
    if (Platform.OS === 'web') {
      prevPhotoPositionRef.current = photoPosition;
      setRepositioningWeb(true);
      setRawPhotoUri(cropSourceUri);
      setShowWebCrop(true);
    } else {
      setTimeout(() => setShowCrop(true), 350);
    }
  }

  function handleCropConfirm(croppedUri) {
    setShowCrop(false);
    applyPickedPhoto(croppedUri, undefined, { crop: true });
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

      // No OS crop step: the full photo is stored as the scorecard's
      // original so Crop Photo (tap the photo) can always crop from — and
      // widen back to — the whole frame. quality stays at 1 (no
      // compression) to avoid graininess in the exported share image, and
      // exif is skipped since it's never used.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: false,
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

  // The green plus beside the totals row only ever needs to open the picker
  // now — the photo itself auto-shows once saved (Fix 2), so there's no
  // "reveal" case left to handle (the button is dimmed/disabled by
  // ScorecardCard once a photo is showing).
  function handleAddPhotoPress() {
    handlePickPhoto();
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

        // The card's photo can still be mid-fetch when the share button is
        // tapped right after picking one — html2canvas would otherwise
        // capture whatever partial/blank frame is in the DOM at that
        // instant. Waiting for it to finish loading (or fail) first avoids
        // that race.
        if (photoUri) {
          await new Promise((resolve) => {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            img.onload = resolve;
            img.onerror = resolve;
            img.src = photoUri;
          });
        }

        // Required lazily: a browser-DOM library, not meaningful (and not
        // necessarily safe to even load) on native.
        const html2canvas = require('html2canvas');
        const node = document.getElementById('scorecard-card');
        const canvas = await html2canvas(node, {
          backgroundColor: colors.navy,
          scale: 4,
          useCORS: true,
          allowTaint: true,
          logging: false,
          imageTimeout: 15000,
        });
        setHideShareExtras(false);

        canvas.toBlob((blob) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'SaveitGolf-Scorecard.jpg';
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
          // JPEG at scale:4 keeps the capture sharp while cutting file size
          // well below the equivalent lossless PNG.
        }, 'image/jpeg', 0.92);
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
      console.log('=== SAVE TO PHOTOS START (ScorecardScreen) ===');
      console.log('Platform:', Platform.OS);
      console.log('shareImageUri:', shareImageUri);

      // Fix 3: the capture can finish with an empty/undefined uri (e.g. the
      // ViewShot ref wasn't ready yet) — Asset.create throws an opaque
      // native error for that, so catch it here with a clearer message.
      if (!shareImageUri) {
        console.log('No shareImageUri to save');
        Alert.alert('Something went wrong', 'Could not capture the scorecard image. Please try again.');
        return;
      }

      try {
        await saveLocalUriToLibrary(shareImageUri);
      } catch (err) {
        if (err.message !== 'PERMISSION_DENIED') throw err;
        Alert.alert('Permission needed', 'Please allow photo access in Settings.');
        return;
      }
      setShowShareModal(false);
      setToastMessage({ text: 'Scorecard saved to Camera Roll', type: 'success' });
    } catch (err) {
      console.error('=== SAVE TO PHOTOS ERROR (ScorecardScreen) ===');
      console.error('Error message:', err.message);
      console.error('Error code:', err.code);
      console.error('Full error:', JSON.stringify(err));
      Alert.alert('Something went wrong', `Could not save your scorecard.\n\n${err.message}`);
    }
  }

  // Hands the image to the native iOS share sheet — AirDrop, Messages,
  // Instagram, etc. all show up there as the user's own choice.
  // ShareOptionsModal only calls this once its own sheet has fully
  // dismissed, so iOS has nothing in the way of presenting the share sheet.
  async function handleShareNative() {
    try {
      const Sharing = require('expo-sharing');
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
        return;
      }
      // Re-capture if the earlier capture came back empty — ViewShot writes
      // its PNG into the app's temp/cache directory either way.
      const uri = shareImageUri || (await captureScorecard());
      if (!uri) throw new Error('No scorecard image was captured.');
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share Scorecard' });
    } catch (err) {
      console.error('Share error:', err);
      Alert.alert('Something went wrong', `Could not share your scorecard.\n\n${err.message}`);
    }
  }

  return (
    <View style={styles.screen}>
      <Header />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          isTablet && { paddingHorizontal: Math.max(16, (windowWidth - 600) / 2) },
        ]}
        showsVerticalScrollIndicator={false}
      >
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

        <PhotoLayoutToggle
          layout={photoLayout}
          onChange={handlePhotoLayoutChange}
          hidden={!photoUri || hideShareExtras}
        />

        <View style={styles.cardWrapper}>
          <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
            <ScorecardCard
              scorecard={activeScorecard}
              fullName={fullName}
              username={profile?.username}
              photoUri={photoUri}
              photoLayout={photoLayout}
              photoPosition={photoPosition}
              onRequestPhoto={handlePhotoPress}
              onRemovePhoto={() => {
                setPhotoUri(null);
                setPhotoPosition({ x: 50, y: 50 });
              }}
              onAddPhoto={handleAddPhotoPress}
              onEditScore={activeScorecard.id ? () => setShowEditScore(true) : undefined}
              hideShareExtras={hideShareExtras}
              captureId="scorecard-card"
            />
          </ViewShot>

          {/* Sits below the card's own top-right remove-photo button in the
              "behind" layout once a photo is showing, instead of
              overlapping it — the "side" layout's remove button lives on
              the photo's left seam instead, so there's nothing to avoid. */}
          <View
            style={[
              styles.topRightButtons,
              photoUri && photoLayout === 'behind' && styles.topRightButtonsBelowPhoto,
            ]}
          >
            {uploadingPhoto && (
              <View style={styles.uploadingPill}>
                <ActivityIndicator size="small" color={colors.white} />
                <Text style={styles.uploadingPillText}>{photoUploadLabel}</Text>
              </View>
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
            <PastScorecardsList
              key={pastListKey}
              userId={user.id}
              onSelect={setDetailScorecard}
              onDeleted={handleScorecardDeleted}
            />
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
        onScorecardUpdated={handleScorecardScoreUpdated}
      />

      <EditScoreModal
        visible={showEditScore}
        scorecard={activeScorecard}
        onClose={() => setShowEditScore(false)}
        onSaved={(updated) => {
          setShowEditScore(false);
          handleScorecardScoreUpdated(updated);
        }}
      />

      <ShareOptionsModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        onSaveToPhotos={handleSaveToPhotos}
        onShare={handleShareNative}
      />

      <Toast
        message={toastMessage?.text}
        type={toastMessage?.type}
        onHide={() => setToastMessage(null)}
      />

      {Platform.OS === 'web' && (
        <WebPhotoCropModal
          visible={showWebCrop}
          uri={rawPhotoUri}
          position={photoPosition}
          onPositionChange={setPhotoPosition}
          onCancel={handleWebCropCancel}
          onConfirm={handleWebCropConfirm}
        />
      )}

      <PhotoActionSheet
        visible={showPhotoActions}
        onChangePhoto={handleChangePhotoAction}
        onCropPhoto={handleCropPhotoAction}
        onClose={() => setShowPhotoActions(false)}
      />

      {Platform.OS !== 'web' && (
        <PhotoCropModal
          visible={showCrop}
          uri={cropSourceUri}
          onCancel={() => setShowCrop(false)}
          onConfirm={handleCropConfirm}
          onChooseDifferent={() => {
            setShowCrop(false);
            // Let the crop modal finish dismissing before the picker presents.
            setTimeout(handlePickPhoto, 350);
          }}
        />
      )}
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
  // The card's own remove-photo button (Option 3) sits at top:10/right:10
  // inside the card itself once a photo is showing — drop this row down
  // below it so the two don't overlap.
  topRightButtonsBelowPhoto: {
    top: 46,
  },
  uploadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(13,31,60,0.9)',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  uploadingPillText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
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
