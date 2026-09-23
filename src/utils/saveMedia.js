import { Platform } from 'react-native';

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

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }
  const album = await MediaLibrary.Album.get('SaveitGolf');
  if (album) {
    await MediaLibrary.Asset.create(uri, album);
  } else {
    await MediaLibrary.Album.create('SaveitGolf', [uri], false);
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
