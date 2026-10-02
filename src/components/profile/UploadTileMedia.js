import { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import colors from '../../theme/colors';

// Generated thumbnails keyed by video URL, kept for the app session so
// re-rendering a profile grid (or revisiting it) doesn't regenerate them.
const thumbnailCache = new Map();

async function generateThumbnail(videoUrl) {
  if (thumbnailCache.has(videoUrl)) return thumbnailCache.get(videoUrl);
  let uri = null;
  try {
    ({ uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, { time: 1000 }));
  } catch {
    // Clips shorter than a second have no frame at 1s — fall back to the
    // very first frame.
    try {
      ({ uri } = await VideoThumbnails.getThumbnailAsync(videoUrl, { time: 0 }));
    } catch (err) {
      console.log('[UploadTileMedia] thumbnail error:', err?.message ?? err);
    }
  }
  thumbnailCache.set(videoUrl, uri);
  return uri;
}

function NativeVideoThumbnail({ url }) {
  const [uri, setUri] = useState(() => thumbnailCache.get(url) ?? null);

  useEffect(() => {
    let cancelled = false;
    generateThumbnail(url).then((result) => {
      if (!cancelled) setUri(result);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!uri) return <View style={styles.placeholder} />;
  return <Image source={{ uri }} style={styles.fill} resizeMode="cover" />;
}

// The image/thumbnail filling a profile Uploads grid tile (ProfileScreen and
// OtherUserProfileScreen). <Image> can't decode video files, which left
// video tiles blank: on web a muted <video> seeked to 0.5s (via the #t=
// media fragment) renders that frame instead, and on native
// expo-video-thumbnails extracts one.
export default function UploadTileMedia({ post }) {
  if (post.isVideo) {
    if (Platform.OS === 'web') {
      return (
        <video
          src={`${post.mediaUrl}#t=0.5`}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          preload="metadata"
          muted
          playsInline
        />
      );
    }
    return <NativeVideoThumbnail url={post.mediaUrl} />;
  }
  return <Image source={{ uri: post.mediaUrl }} style={styles.fill} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.navyCard,
  },
});
