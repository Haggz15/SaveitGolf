import { Alert, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

// Videos are big — on cellular, confirm before uploading one. Photos always
// go straight through. Resolves true when the upload should proceed. Web is
// skipped: browsers rarely report connection type and Alert has no buttons
// there.
export async function confirmVideoUploadOnNetwork(mediaType) {
  if (mediaType !== 'video' || Platform.OS === 'web') return true;
  let state;
  try {
    state = await NetInfo.fetch();
  } catch (err) {
    console.error('[networkCheck] NetInfo.fetch failed:', err);
    return true;
  }
  if (state.type !== 'cellular') return true;
  return new Promise((resolve) => {
    Alert.alert(
      'Upload on WiFi?',
      'You are on cellular data. Video uploads use a lot of data. Upload anyway?',
      [
        { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
        { text: 'Upload Anyway', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
