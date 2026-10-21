import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';
import colors from '../../theme/colors';
import ScorecardCard from './ScorecardCard';
import PhotoLayoutToggle from './PhotoLayoutToggle';
import WebPhotoCropModal from './WebPhotoCropModal';
import PhotoCropModal from './PhotoCropModal';
import PhotoActionSheet from './PhotoActionSheet';
import EditScoreModal from './EditScoreModal';
import ShareOptionsModal from './ShareOptionsModal';
import Toast from '../Toast';
import { saveScorecardPhoto, setScorecardPhotoUrl, updateScorecardPhotoLayout } from '../../services/scorecards';
import { compressImage } from '../../utils/imageCompression';
import { useAuth } from '../../context/AuthContext';
import { saveLocalUriToLibrary } from '../../utils/saveMedia';

const CAPTURE_ID = 'scorecard-detail-card';

// Full view of a single past scorecard, opened from PastScorecardsList.
// Matches the pageSheet convention used by NewScorecardModal /
// CourseRankingModal. Auto-shows the scorecard's saved photo_url on open
// (Fix 2) — same as the live Scorecard screen — instead of hiding it behind
// the green plus. Adding or changing a photo is restricted to the
// scorecard's own owner; viewing someone else's scorecard is otherwise
// fully read-only except for the Share button, which is always available.
// `onScorecardUpdated` gets the scorecard back after its owner edits the score.
export default function ScorecardDetailModal({ visible, scorecard, fullName, onClose, onScorecardUpdated }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const shareCardRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  // True while a share capture is in flight — hides the green plus / revert
  // arrow (Fix 2/3) so neither ends up in the captured image.
  const [hideShareExtras, setHideShareExtras] = useState(false);
  const [shareImageUri, setShareImageUri] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState(null);
  // The photo as first attached (original_photo_url) — what every crop
  // starts from. Null until known; savedPhotoUrl is the original then.
  const [savedOriginalUrl, setSavedOriginalUrl] = useState(null);
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
  // 'side' or 'behind' (Fix 2/5) — initialized from the scorecard's saved
  // preference and reset whenever a different scorecard is opened.
  const [photoLayout, setPhotoLayout] = useState('behind');
  // True while a just-picked photo is uploading to Supabase storage in the
  // background — the picked photo is already showing locally (see
  // applyPickedPhoto), this just drives a small "Uploading…" indicator.
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [showEditScore, setShowEditScore] = useState(false);

  useEffect(() => {
    setPhotoUri(scorecard?.photoUrl ?? null);
    setPhotoPosition({ x: 50, y: 50 });
    setSavedPhotoUrl(scorecard?.photoUrl ?? null);
    setSavedOriginalUrl(scorecard?.originalPhotoUrl ?? null);
    setPhotoLayout(scorecard?.photoLayout || 'behind');
  }, [scorecard?.id]);

  const isOwner = Boolean(user?.id) && user.id === scorecard?.userId;

  // Every crop starts from the photo as first attached, never from an
  // earlier crop, so the frame can always be widened again.
  const cropSourceUri = savedOriginalUrl || savedPhotoUrl || photoUri;

  // `crop: true` when `uri` is a crop of the current photo rather than a
  // newly picked one — it then keeps the stored original (see
  // saveScorecardPhoto).
  async function applyPickedPhoto(uri, position = { x: 50, y: 50 }, { crop = false } = {}) {
    // Fix 2: layout always defaults to "behind" the first time a photo is
    // attached, even if a previous photo on this scorecard had been
    // switched to "side".
    const isFirstPhoto = !crop && !savedPhotoUrl;
    setPhotoUri(uri);
    setPhotoPosition(position);
    if (isFirstPhoto) setPhotoLayout('behind');
    if (!user?.id || !scorecard?.id) return;
    try {
      setUploadingPhoto(true);
      // Same downsize/recompress as ScorecardScreen — the picker hands back
      // the full-quality original.
      const compressedUri = await compressImage(uri);
      const { photoUrl: uploadedUrl, originalPhotoUrl } = await saveScorecardPhoto(user.id, scorecard.id, compressedUri, {
        crop,
        originalPhotoUrl: cropSourceUri,
      });
      setSavedPhotoUrl(uploadedUrl);
      if (originalPhotoUrl) setSavedOriginalUrl(originalPhotoUrl);
      setPhotoUri(uploadedUrl);
      if (isFirstPhoto) {
        await updateScorecardPhotoLayout(scorecard.id, 'behind').catch((err) =>
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
  // instantly for anyone viewing, but only persists (Fix 5) when the
  // viewer owns this scorecard (a non-owner's update would fail the
  // scorecards RLS policy anyway).
  function handlePhotoLayoutChange(layout) {
    setPhotoLayout(layout);
    if (isOwner && scorecard?.id) {
      updateScorecardPhotoLayout(scorecard.id, layout).catch((err) =>
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
      setSavedPhotoUrl(rawPhotoUri);
      if (scorecard?.id) {
        setScorecardPhotoUrl(scorecard.id, rawPhotoUri).catch((err) =>
          console.error('Failed to restore original photo:', err)
        );
      }
    }
    // Otherwise repositioning only moves the frame — nothing to upload.
    setRawPhotoUri(null);
    setRepositioningWeb(false);
  }

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
  // "reveal" case left to handle, and the button is owner-only.
  function handleAddPhotoPress() {
    if (isOwner) handlePickPhoto();
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
        const node = document.getElementById(CAPTURE_ID);
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
          setToastMessage({ text: 'Scorecard saved to Downloads', type: 'success' });
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

  // Native only — mirrors ScorecardScreen's captureScorecard.
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
      console.log('=== SAVE TO PHOTOS START (ScorecardDetailModal) ===');
      console.log('Platform:', Platform.OS);
      console.log('shareImageUri:', shareImageUri);

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
      console.error('=== SAVE TO PHOTOS ERROR (ScorecardDetailModal) ===');
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

  const hasPhoto = Boolean(photoUri);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scorecard</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {scorecard && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <PhotoLayoutToggle layout={photoLayout} onChange={handlePhotoLayoutChange} hidden={!photoUri || hideShareExtras} />

            <View style={styles.cardWrapper}>
              <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1 }}>
                <ScorecardCard
                  scorecard={scorecard}
                  fullName={fullName}
                  photoUri={photoUri}
                  photoLayout={photoLayout}
                  photoPosition={photoPosition}
                  onRequestPhoto={isOwner ? handlePhotoPress : undefined}
                  onRemovePhoto={() => {
                    setPhotoUri(null);
                    setPhotoPosition({ x: 50, y: 50 });
                  }}
                  onAddPhoto={savedPhotoUrl || isOwner ? handleAddPhotoPress : undefined}
                  onEditScore={isOwner && scorecard?.id ? () => setShowEditScore(true) : undefined}
                  hideShareExtras={hideShareExtras}
                  captureId={CAPTURE_ID}
                />
              </ViewShot>

              {uploadingPhoto && (
                <View style={styles.uploadingPill}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.uploadingPillText}>Uploading…</Text>
                </View>
              )}

              {/* Always visible (Fix 2) — sits below the card's own top-right
                  remove-photo button once a photo is showing in the "behind"
                  layout so the two don't overlap, same as ScorecardScreen. */}
              <View
                style={[
                  styles.topRightButtons,
                  hasPhoto && photoLayout === 'behind' && styles.topRightButtonsBelowPhoto,
                ]}
              >
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
          </ScrollView>
        )}
      </View>

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

      <EditScoreModal
        visible={showEditScore}
        scorecard={scorecard}
        onClose={() => setShowEditScore(false)}
        onSaved={(updated) => {
          setShowEditScore(false);
          onScorecardUpdated?.(updated);
        }}
      />

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
    </Modal>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  cardWrapper: {
    backgroundColor: colors.navyLight,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  // Sits at the card's top-left so it doesn't collide with the card's own
  // top-right remove-photo button (Option 3) once a photo is showing.
  uploadingPill: {
    position: 'absolute',
    top: 10,
    left: 10,
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
  // The card's own remove-photo button sits at top:10/right:10 inside the
  // card itself once a photo is showing — drop this row down below it so
  // the two don't overlap.
  topRightButtonsBelowPhoto: {
    top: 46,
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
});
