import { Platform } from 'react-native';

// Longest edge after compression — 1280 gives 720p, plenty for the feed.
const MAX_VIDEO_DIMENSION = 1280;

// react-native-compressor is native code, so it only exists in builds made
// after it was added. Loaded lazily and guarded: on an older build (reached
// by an OTA update) or on web, requiring it throws, and every caller falls
// back to uploading the video as picked.
let videoCompressor;
function getVideoCompressor() {
  if (videoCompressor !== undefined) return videoCompressor;
  videoCompressor = null;
  if (Platform.OS === 'web') return videoCompressor;
  try {
    videoCompressor = require('react-native-compressor').Video;
  } catch (err) {
    console.warn('[videoCompression] react-native-compressor unavailable — uploading videos uncompressed');
  }
  return videoCompressor;
}

export function isVideoCompressionAvailable() {
  return getVideoCompressor() != null;
}

// Re-encodes a picked/recorded video WhatsApp-style ('auto' picks the
// bitrate from the resolution), long edge capped at 1280px — a 30s phone
// clip comes out at a few MB instead of 20-80 MB. Falls back to the
// original uri if compression isn't available or fails, so it never blocks
// the post.
export async function compressVideo(uri, onProgress) {
  const Video = getVideoCompressor();
  if (!Video) return uri;
  try {
    return await Video.compress(uri, { compressionMethod: 'auto', maxSize: MAX_VIDEO_DIMENSION }, onProgress);
  } catch (err) {
    console.error('Video compression error:', err);
    return uri;
  }
}
