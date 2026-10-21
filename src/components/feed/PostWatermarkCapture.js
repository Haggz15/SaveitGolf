import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import colors from '../../theme/colors';

// Exported image size in pixels: 4:5 portrait, Instagram's preferred feed
// format, so it posts without being cropped. The photo is cover-fitted into it.
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
// Watermark is authored at these sizes for a phone-width (390pt) image and
// scaled up with the export, so it looks the same relative size on any photo.
const REFERENCE_WIDTH = 390;
// Transparent cutout of the app icon (icon.png has its navy background baked
// in), so only the ball and tee float over the photo.
const LOGO = require('../../../assets/watermark-logo.png');
const LOGO_SIZE = 36;
const USERNAME_FONT_SIZE = 14;
const LOCATION_FONT_SIZE = 12;
const WORDMARK_FONT_SIZE = 28;
// Inset of both watermark elements from the photo's edges.
const EDGE_INSET = 12;
// Bail out if the photo never loads (bad URL, offline) instead of leaving
// the Save button spinning forever.
const LOAD_TIMEOUT_MS = 15000;

// Two frames: one for the onLoad state to commit, one for the native image
// layer to actually draw the decoded bitmap before ViewShot reads the view.
function nextFrames() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

// Mounted once per FeedScreen (never inside FlatList cells) and kept
// off-screen. stamp(uri, { username, location }) renders the photo on a 4:5
// canvas with the app logo, "@username" and the location line (e.g.
// "Hole 7 · Scranton Country Club") in the top-left corner and a "SaveitGolf" script wordmark in the
// bottom-right (no backgrounds — drop shadows keep the white text legible on
// any photo), waits for both the photo and the icon to load, captures it with ViewShot and resolves with the local file URI of
// the watermarked JPEG.
const PostWatermarkCapture = forwardRef(function PostWatermarkCapture(_props, ref) {
  const viewShotRef = useRef(null);
  const [job, setJob] = useState(null); // { id, uri, username, location, width, height }
  const pendingRef = useRef(null); // { id, resolve, reject, timer }
  // Serialises stamp() calls — there's only one off-screen canvas.
  const queueRef = useRef(Promise.resolve());
  const jobIdRef = useRef(0);
  // Images loaded for the current job; capture once both photo and logo are in.
  const loadedRef = useRef({ id: null, count: 0 });

  const finish = useCallback((id, error, result) => {
    const pending = pendingRef.current;
    if (!pending || pending.id !== id) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setJob(null);
    if (error) pending.reject(error);
    else pending.resolve(result);
  }, []);

  const runStamp = useCallback(async (uri, { username, location } = {}) => {
    const pixelRatio = PixelRatio.get();
    const width = EXPORT_WIDTH / pixelRatio;
    const height = EXPORT_HEIGHT / pixelRatio;
    const id = ++jobIdRef.current;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => finish(id, new Error('Timed out loading image for watermark')),
        LOAD_TIMEOUT_MS
      );
      pendingRef.current = { id, resolve, reject, timer };
      setJob({ id, uri, username, location, width, height });
    });
  }, [finish]);

  useImperativeHandle(ref, () => ({
    stamp(uri, details) {
      const result = queueRef.current.then(() => runStamp(uri, details));
      queueRef.current = result.catch(() => {});
      return result;
    },
  }), [runStamp]);

  async function handleLoad(id) {
    if (loadedRef.current.id !== id) loadedRef.current = { id, count: 0 };
    loadedRef.current.count += 1;
    if (loadedRef.current.count < 2) return;
    try {
      await nextFrames();
      const capturedUri = await viewShotRef.current.capture();
      if (!capturedUri) throw new Error('Watermark capture returned no image');
      finish(id, null, capturedUri);
    } catch (err) {
      finish(id, err);
    }
  }

  if (!job) return null;

  const scale = job.width / REFERENCE_WIDTH;
  const fontSize = USERNAME_FONT_SIZE * scale;
  const locationSize = LOCATION_FONT_SIZE * scale;
  const logoSize = LOGO_SIZE * scale;
  const wordmarkSize = WORDMARK_FONT_SIZE * scale;
  const inset = EDGE_INSET * scale;
  const shadow = { textShadowRadius: 3 * scale, textShadowOffset: { width: 0, height: scale } };

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <ViewShot
        ref={viewShotRef}
        options={{ format: 'jpg', quality: 0.92, result: 'tmpfile', width: EXPORT_WIDTH, height: EXPORT_HEIGHT }}
      >
        <View collapsable={false} style={{ width: job.width, height: job.height }}>
          <Image
            key={job.id}
            source={{ uri: job.uri }}
            style={{ width: job.width, height: job.height }}
            resizeMode="cover"
            onLoad={() => handleLoad(job.id)}
            onError={(e) => finish(job.id, new Error(e?.nativeEvent?.error || 'Could not load image'))}
          />
          <View style={[styles.byline, { top: inset, left: inset, gap: 6 * scale }]}>
            <Image
              key={`logo-${job.id}`}
              source={LOGO}
              style={{ width: logoSize, height: logoSize }}
              onLoad={() => handleLoad(job.id)}
              onError={() => finish(job.id, new Error('Could not load watermark logo'))}
            />
            {/* Width-capped so a long course name truncates instead of running off the photo. */}
            <View style={{ maxWidth: job.width - inset * 2 - logoSize - 6 * scale }}>
              {job.username ? (
                <Text style={[styles.username, styles.shadow, shadow, { fontSize, lineHeight: fontSize * 1.3 }]}>
                  @{job.username}
                </Text>
              ) : null}
              {job.location ? (
                <Text
                  numberOfLines={1}
                  style={[styles.location, styles.shadow, shadow, { fontSize: locationSize, lineHeight: locationSize * 1.3 }]}
                >
                  {job.location}
                </Text>
              ) : null}
            </View>
          </View>
          <Text
            style={[
              styles.wordmark,
              styles.shadow,
              shadow,
              {
                bottom: inset,
                right: inset,
                fontSize: wordmarkSize,
                lineHeight: wordmarkSize * 1.3,
                // Room for the trailing 'f' swash, which overhangs the glyph box.
                paddingRight: 16 * scale,
              },
            ]}
          >
            SaveitGolf
          </Text>
        </View>
      </ViewShot>
    </View>
  );
});

export default PostWatermarkCapture;

// Used by the feed's Save button. Resolves with the
// local URI of a watermarked copy when the post is someone else's photo, or
// null when the original file should be used as-is: videos, the user's own
// posts, web (no ViewShot there), or a failed stamp — a watermark problem
// shouldn't block the save/share itself.
// "Hole 7 · Scranton Country Club", or whichever half the post has.
function formatPostLocation(post) {
  const parts = [];
  if (post.hole != null) parts.push(`Hole ${post.hole}`);
  if (post.course) parts.push(post.course);
  return parts.join(' · ');
}

export async function stampPostPhoto({ post, currentUserId, captureRef }) {
  const capture = captureRef?.current;
  const isVideo = post.isVideo ?? Boolean(post.video);
  if (Platform.OS === 'web' || isVideo || !post.mediaUrl || post.userId === currentUserId || !capture) {
    return null;
  }
  try {
    return await capture.stamp(post.mediaUrl, { username: post.user, location: formatPostLocation(post) });
  } catch (err) {
    console.error('Failed to watermark photo, using original instead:', err);
    return null;
  }
}

const styles = StyleSheet.create({
  // Rendered (so ViewShot has real pixels to read) but parked far outside
  // the viewport — opacity: 0 would make the captured image blank too.
  offscreen: {
    position: 'absolute',
    left: -10000,
    top: 0,
  },
  byline: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
  },
  username: {
    fontWeight: '600',
    color: colors.white,
  },
  location: {
    fontWeight: '500',
    color: colors.white,
  },
  // Font is loaded app-wide in App.js, so it's ready before any capture.
  wordmark: {
    position: 'absolute',
    fontFamily: 'DancingScript_700Bold',
    color: colors.white,
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
  },
});
