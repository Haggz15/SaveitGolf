import { Alert, Linking, Platform } from 'react-native';

// Shown wherever a camera-roll save hits PERMISSION_DENIED — the system
// prompt won't appear again once declined, so Settings is the only way back.
export function showPhotoPermissionAlert() {
  Alert.alert('Photo Access Needed', 'Please allow photo library access in Settings to save videos.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Open Settings', onPress: () => Linking.openSettings() },
  ]);
}

// Shared by saveMediaToDevice and the scorecard share-card save: both end
// up with a local file URI that just needs permission to write into the
// camera roll.
export async function saveLocalUriToLibrary(uri) {
  // Required lazily: this native module isn't available on web and throws
  // at import time if loaded statically there.
  // expo-media-library 57 removed the function API (createAssetAsync,
  // createAlbumAsync, saveToLibraryAsync all throw at runtime) in favour of
  // the class-based Asset/Album API.
  const MediaLibrary = require('expo-media-library');

  let permission;
  try {
    permission = await MediaLibrary.requestPermissionsAsync();
  } catch (err) {
    console.error('Photo library permission request failed:', err);
    throw new Error('PERMISSION_DENIED');
  }
  if (permission.status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  // On iOS, Album.get/Album.create need *full* library access — with
  // "Limited" access the status is still 'granted' but every album call
  // throws FailedToGrantPermissions. Asset.create only needs write access,
  // so without full access (or if the album step fails for any other
  // reason) save straight to the camera roll, outside the SaveitGolf album.
  const hasFullAccess = Platform.OS !== 'ios' || permission.accessPrivileges === 'all';
  if (hasFullAccess) {
    try {
      const album = await MediaLibrary.Album.get('SaveitGolf');
      if (album) {
        await MediaLibrary.Asset.create(uri, album);
      } else {
        await MediaLibrary.Album.create('SaveitGolf', [uri], false);
      }
      return;
    } catch (err) {
      console.warn('Saving into the SaveitGolf album failed, saving to camera roll instead:', err);
    }
  }

  try {
    await MediaLibrary.Asset.create(uri);
  } catch (err) {
    if (String(err?.code || err?.message || '').includes('FailedToGrantPermissions')) {
      throw new Error('PERMISSION_DENIED');
    }
    throw err;
  }
}

function downloadBlobWeb(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
}

// Downloads a post's media and saves it to the device's camera roll (native)
// or triggers a real file download (web) — used by the Feed's bookmark
// button. Web needs a blob: URL rather than the bare media_url so the
// browser downloads the file instead of just navigating to it.
export async function saveMediaToDevice(mediaUrl) {
  if (Platform.OS === 'web') {
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    const filename = mediaUrl.split('/').pop()?.split('?')[0] || 'saveitgolf-media';
    downloadBlobWeb(blob, filename);
    return;
  }

  // Required lazily: this native module isn't available on web and throws
  // at import time if loaded statically there.
  const { File, Paths, Directory } = require('expo-file-system');

  // Asset.create needs a local file, not a remote URL, so download it
  // into the cache directory first.
  const downloaded = await File.downloadFileAsync(mediaUrl, new Directory(Paths.cache), {
    idempotent: true,
  });
  await saveLocalUriToLibrary(downloaded.uri);
}
