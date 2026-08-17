import { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import ScorecardCard from './ScorecardCard';
import PhotoCropModal from './PhotoCropModal';
import { saveScorecardPhoto } from '../../services/scorecards';
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
  // Web only: the just-picked, not-yet-cropped photo — see ScorecardScreen's
  // matching state for why native never sets this.
  const [cropPhotoUri, setCropPhotoUri] = useState(null);

  useEffect(() => {
    setPhotoUri(null);
    setSavedPhotoUrl(scorecard?.photoUrl ?? null);
  }, [scorecard?.id]);

  const isOwner = Boolean(user?.id) && user.id === scorecard?.userId;

  async function applyPickedPhoto(uri) {
    setPhotoUri(uri);
    if (!user?.id || !scorecard?.id) return;
    try {
      const uploadedUrl = await saveScorecardPhoto(user.id, scorecard.id, uri);
      setSavedPhotoUrl(uploadedUrl);
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
    input.style.display = 'none';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      document.body.removeChild(input);
      if (!file) return;
      setCropPhotoUri(URL.createObjectURL(file));
    };
    document.body.appendChild(input);
    input.click();
  }

  function handleCropConfirm(croppedUri) {
    setCropPhotoUri(null);
    applyPickedPhoto(croppedUri);
  }

  function handleCropCancel() {
    setCropPhotoUri(null);
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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Scorecard</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {scorecard && (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.cardWrapper}>
              <ScorecardCard
                scorecard={scorecard}
                fullName={fullName}
                photoUri={photoUri}
                onRequestPhoto={isOwner ? handlePickPhoto : undefined}
                onRemovePhoto={() => setPhotoUri(null)}
                onAddPhoto={savedPhotoUrl || isOwner ? handleAddPhotoPress : undefined}
              />
            </View>
          </ScrollView>
        )}
      </View>

      <PhotoCropModal
        visible={Boolean(cropPhotoUri)}
        photoUri={cropPhotoUri}
        onCancel={handleCropCancel}
        onConfirm={handleCropConfirm}
      />
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
  },
});
