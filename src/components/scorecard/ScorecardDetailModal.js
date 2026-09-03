import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import ScorecardCard from './ScorecardCard';
import PhotoLayoutToggle from './PhotoLayoutToggle';
import WebPhotoCropModal from './WebPhotoCropModal';
import { saveScorecardPhoto, updateScorecardPhotoLayout } from '../../services/scorecards';
import { useAuth } from '../../context/AuthContext';

// Full view of a single past scorecard, opened from PastScorecardsList.
// Matches the pageSheet convention used by NewScorecardModal /
// CourseRankingModal. Always opens in the no-photo layout even when the
// scorecard has a saved photo_url (Fix 1) — the green plus beside the
// totals row reveals it. Adding a *new* photo (rather than just revealing
// an existing one) is restricted to the scorecard's own owner; viewing
// someone else's scorecard is otherwise fully read-only.
export default function ScorecardDetailModal({ visible, scorecard, fullName, onClose }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [photoUri, setPhotoUri] = useState(null);
  const [savedPhotoUrl, setSavedPhotoUrl] = useState(null);
  // Web only: which part of the photo the `cover`-resized frame centers on
  // (see WebPhotoCropModal) — native bakes its crop into the picked file
  // itself via allowsEditing, so this stays at its default center there.
  const [photoPosition, setPhotoPosition] = useState({ x: 50, y: 50 });
  // Web only: the just-picked, not-yet-positioned photo waiting on
  // WebPhotoCropModal, and whether that modal is open.
  const [rawPhotoUri, setRawPhotoUri] = useState(null);
  const [showWebCrop, setShowWebCrop] = useState(false);
  // 'side' or 'behind' (Fix 2/5) — initialized from the scorecard's saved
  // preference and reset whenever a different scorecard is opened.
  const [photoLayout, setPhotoLayout] = useState('behind');
  // True while a just-picked photo is uploading to Supabase storage in the
  // background — the picked photo is already showing locally (see
  // applyPickedPhoto), this just drives a small "Uploading…" indicator.
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    setPhotoUri(null);
    setPhotoPosition({ x: 50, y: 50 });
    setSavedPhotoUrl(scorecard?.photoUrl ?? null);
    setPhotoLayout(scorecard?.photoLayout || 'behind');
  }, [scorecard?.id]);

  const isOwner = Boolean(user?.id) && user.id === scorecard?.userId;

  async function applyPickedPhoto(uri, position = { x: 50, y: 50 }) {
    // Fix 2: layout always defaults to "behind" the first time a photo is
    // attached, even if a previous photo on this scorecard had been
    // switched to "side".
    const isFirstPhoto = !savedPhotoUrl;
    setPhotoUri(uri);
    setPhotoPosition(position);
    if (isFirstPhoto) setPhotoLayout('behind');
    if (!user?.id || !scorecard?.id) return;
    try {
      setUploadingPhoto(true);
      const uploadedUrl = await saveScorecardPhoto(user.id, scorecard.id, uri);
      setSavedPhotoUrl(uploadedUrl);
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
  }

  function handleWebCropConfirm() {
    setShowWebCrop(false);
    applyPickedPhoto(rawPhotoUri, photoPosition);
    setRawPhotoUri(null);
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

      // allowsEditing shows the native OS crop UI for both layouts — no
      // aspect ratio is forced so the user isn't boxed into a specific crop
      // shape (Fix 1). quality stays at 1 (no compression) to avoid
      // graininess in the exported share image, and exif is skipped since
      // it's never used.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
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

  // The green plus beside the totals row (Fix 2/4): reveals an already-saved
  // photo for any viewer, but only opens the picker to attach a new one when
  // the viewer owns this scorecard.
  function handleAddPhotoPress() {
    if (savedPhotoUrl) {
      setPhotoUri(savedPhotoUrl);
    } else if (isOwner) {
      handlePickPhoto();
    }
  }

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
            <PhotoLayoutToggle layout={photoLayout} onChange={handlePhotoLayoutChange} hidden={!photoUri} />

            <View style={styles.cardWrapper}>
              <ScorecardCard
                scorecard={scorecard}
                fullName={fullName}
                photoUri={photoUri}
                photoLayout={photoLayout}
                photoPosition={photoPosition}
                onRequestPhoto={isOwner ? handlePickPhoto : undefined}
                onRemovePhoto={() => {
                  setPhotoUri(null);
                  setPhotoPosition({ x: 50, y: 50 });
                }}
                onAddPhoto={savedPhotoUrl || isOwner ? handleAddPhotoPress : undefined}
              />
              {uploadingPhoto && (
                <View style={styles.uploadingPill}>
                  <ActivityIndicator size="small" color={colors.white} />
                  <Text style={styles.uploadingPillText}>Uploading…</Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </View>

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
});
