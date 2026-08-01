import { Platform } from 'react-native';

// Downloads a post's media and saves it to the device's camera roll (native)
// or triggers a real file download (web) — used by the Feed's bookmark
// button. Web needs a blob: URL rather than the bare media_url so the
// browser downloads the file instead of just navigating to it.
export async function saveMediaToDevice(mediaUrl) {
  if (Platform.OS === 'web') {
    const response = await fetch(mediaUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const filename = mediaUrl.split('/').pop()?.split('?')[0] || 'saveitgolf-media';

    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // Required lazily: these native modules aren't available on web and throw
  // at import time if loaded statically there.
  const { File, Paths, Directory } = require('expo-file-system');
  const MediaLibrary = require('expo-media-library');

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    throw new Error('PERMISSION_DENIED');
  }

  // saveToLibraryAsync needs a local file, not a remote URL, so download it
  // into the cache directory first.
  const downloaded = await File.downloadFileAsync(mediaUrl, new Directory(Paths.cache), {
    idempotent: true,
  });
  await MediaLibrary.saveToLibraryAsync(downloaded.uri);
}
