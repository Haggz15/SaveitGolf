import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import VideoWatermark from '../../../modules/video-watermark';
import colors from '../../theme/colors';

// Exported image size in pixels: 4:5 portrait, Instagram's preferred feed
// format, so it posts without being cropped, and a story shows it whole
// (letterboxed) below the story header. The photo is cover-fitted into it.
const EXPORT_WIDTH = 1080;
const EXPORT_HEIGHT = 1350;
// Video overlays keep the video's own aspect ratio; their short side is
// capped here (the native side scales the PNG up to the full frame).
// The watermark itself is kept inside the frame's centred band of at most
// 4:5 (tall) / 1.91:1 (wide): Instagram crops feed posts to those limits,
// and on a full-screen 9:16 story that band also clears the header and
// reply bar, so nothing gets cut off or covered either way.
const SAFE_MAX_TALL = 5 / 4;
const SAFE_MAX_WIDE = 1.91;
const VIDEO_OVERLAY_MAX_SHORT_SIDE = 1080;
// Watermark is authored at these sizes for a phone-width (390pt) image and
// scaled up with the export, so it looks the same relative size on any photo.
const REFERENCE_WIDTH = 390;
// Transparent cutout of the app icon (icon.png has its navy background baked
// in), so only the ball and tee float over the photo.
const LOGO = require('../../../assets/watermark-logo.png');
const LOGO_SIZE = 36;
// Also used for the course/hole line under the wordmark.
const USERNAME_FONT_SIZE = 14;
const WORDMARK_FONT_SIZE = 28;
// Inset of both watermark elements from the edges of the safe band.
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
// canvas with the app logo and "@username" in the top-left corner and, stacked
// in the bottom-right, a "SaveitGolf" script wordmark over the location line
// (e.g. "Scranton Country Club · Hole 7") — all white, no backgrounds; every
// line gets the same heavy drop shadow as the feed's course name so it stays legible
// on any photo. It waits for both the photo and
// the icon to load, captures it with ViewShot and resolves with the local
// file URI of the watermarked JPEG.
//
// overlay({ width, height, username, location }) draws the same watermark
// with no photo underneath and resolves with a transparent PNG of that pixel
// size, which the VideoWatermark native module burns into each video frame.
const PostWatermarkCapture = forwardRef(function PostWatermarkCapture(_props, ref) {
  const viewShotRef = useRef(null);
  // { id, uri, username, location, width, height, pixelWidth, pixelHeight, overlayOnly }
  const [job, setJob] = useState(null);
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

  const runJob = useCallback(async ({ uri = null, username, location, pixelWidth, pixelHeight, overlayOnly }) => {
    const pixelRatio = PixelRatio.get();
    const width = pixelWidth / pixelRatio;
    const height = pixelHeight / pixelRatio;
    const id = ++jobIdRef.current;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => finish(id, new Error('Timed out loading image for watermark')),
        LOAD_TIMEOUT_MS
      );
      pendingRef.current = { id, resolve, reject, timer };
      setJob({ id, uri, username, location, width, height, pixelWidth, pixelHeight, overlayOnly });
    });
  }, [finish]);

  useImperativeHandle(ref, () => {
    function enqueue(job) {
      const result = queueRef.current.then(() => runJob(job));
      queueRef.current = result.catch(() => {});
      return result;
    }
    return {
      stamp(uri, { username, location } = {}) {
        return enqueue({
          uri,
          username,
          location,
          pixelWidth: EXPORT_WIDTH,
          pixelHeight: EXPORT_HEIGHT,
          overlayOnly: false,
        });
      },
      overlay({ width, height, username, location }) {
        const fit = Math.min(1, VIDEO_OVERLAY_MAX_SHORT_SIDE / Math.min(width, height));
        return enqueue({
          username,
          location,
          pixelWidth: Math.round(width * fit),
          pixelHeight: Math.round(height * fit),
          overlayOnly: true,
        });
      },
    };
  }, [runJob]);

  // Capture once every image in the job has loaded: the photo and the logo,
  // or just the logo for a video overlay.
  async function handleLoad(id, needed) {
    if (loadedRef.current.id !== id) loadedRef.current = { id, count: 0 };
    loadedRef.current.count += 1;
    if (loadedRef.current.count < needed) return;
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

  const needed = job.overlayOnly ? 1 : 2;
  // Sized off the short side so landscape videos don't get an oversized mark.
  const scale = Math.min(job.width, job.height) / REFERENCE_WIDTH;
  const fontSize = USERNAME_FONT_SIZE * scale;
  const logoSize = LOGO_SIZE * scale;
  const wordmarkSize = WORDMARK_FONT_SIZE * scale;
  const inset = EDGE_INSET * scale;
  const safeWidth = Math.min(job.width, job.height * SAFE_MAX_WIDE);
  const safeHeight = Math.min(job.height, job.width * SAFE_MAX_TALL);
  const insetX = (job.width - safeWidth) / 2 + inset;
  const insetY = (job.height - safeHeight) / 2 + inset;
  // Matches FeedScreen's topLeftCourseName shadow, scaled with the export.
  const shadow = { textShadowRadius: 8 * scale, textShadowOffset: { width: 0, height: 2 * scale } };

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <ViewShot
        ref={viewShotRef}
        options={{
          // PNG keeps the video overlay's background transparent.
          format: job.overlayOnly ? 'png' : 'jpg',
          quality: 0.92,
          result: 'tmpfile',
          width: job.pixelWidth,
          height: job.pixelHeight,
        }}
      >
        <View collapsable={false} style={{ width: job.width, height: job.height }}>
          {job.overlayOnly ? null : (
            <Image
              key={job.id}
              source={{ uri: job.uri }}
              style={{ width: job.width, height: job.height }}
              resizeMode="cover"
              onLoad={() => handleLoad(job.id, needed)}
              onError={(e) => finish(job.id, new Error(e?.nativeEvent?.error || 'Could not load image'))}
            />
          )}
          <View style={[styles.byline, { top: insetY, left: insetX, gap: 6 * scale }]}>
            <Image
              key={`logo-${job.id}`}
              source={LOGO}
              style={{ width: logoSize, height: logoSize }}
              onLoad={() => handleLoad(job.id, needed)}
              onError={() => finish(job.id, new Error('Could not load watermark logo'))}
            />
            {job.username ? (
              <Text
                numberOfLines={1}
                style={[
                  styles.username,
                  styles.shadow,
                  shadow,
                  { fontSize, lineHeight: fontSize * 1.3, maxWidth: safeWidth - inset * 2 - logoSize - 6 * scale },
                ]}
              >
                @{job.username}
              </Text>
            ) : null}
          </View>
          {/* Width-capped so a long course name truncates instead of running off the photo. */}
          <View style={[styles.signature, { bottom: insetY, right: insetX, maxWidth: safeWidth - inset * 2 }]}>
            <Text
              style={[
                styles.wordmark,
                styles.shadow,
                shadow,
                {
                  fontSize: wordmarkSize,
                  lineHeight: wordmarkSize * 1.3,
                  // Room for the trailing 'f' swash, which overhangs the glyph box.
                  paddingRight: 16 * scale,
                },
              ]}
            >
              SaveitGolf
            </Text>
            {job.location ? (
              <Text
                numberOfLines={1}
                style={[styles.location, styles.shadow, shadow, { fontSize, lineHeight: fontSize * 1.3 }]}
              >
                {job.location}
              </Text>
            ) : null}
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

export default PostWatermarkCapture;

// "Scranton Country Club · Falls · Hole 7", or whichever parts the post has.
function formatPostLocation(post) {
  const parts = [];
  if (post.course) parts.push(post.course);
  if (post.nineName) parts.push(post.nineName);
  if (post.hole != null) parts.push(`Hole ${post.hole}`);
  return parts.join(' · ');
}

// Downloads the video, draws a transparent overlay at its exact aspect
// ratio and has the native module burn it into every frame.
async function stampPostVideo(mediaUrl, capture, details) {
  if (!VideoWatermark) return null;
  // Required lazily: this native module throws at import time on web.
  const { File, Paths, Directory } = require('expo-file-system');
  const video = await File.downloadFileAsync(mediaUrl, new Directory(Paths.cache), { idempotent: true });
  const { width, height } = await VideoWatermark.getVideoSize(video.uri);
  const overlayUri = await capture.overlay({ ...details, width, height });
  return VideoWatermark.stamp(video.uri, overlayUri);
}

// Used by the feed's Save button. Every post — photo or video, the user's
// own or someone else's — gets the identical watermark. Resolves with the
// local URI of the watermarked copy, or null when the original file should
// be used as-is: web (no ViewShot there), builds without the VideoWatermark
// module, or a failed stamp — a watermark problem shouldn't block the
// save/share itself.
export async function stampPostMedia({ post, captureRef }) {
  const capture = captureRef?.current;
  if (Platform.OS === 'web' || !post.mediaUrl || !capture) {
    return null;
  }
  const details = { username: post.user, location: formatPostLocation(post) };
  const isVideo = post.isVideo ?? Boolean(post.video);
  try {
    return isVideo
      ? await stampPostVideo(post.mediaUrl, capture, details)
      : await capture.stamp(post.mediaUrl, details);
  } catch (err) {
    console.error('Failed to watermark post media, using original instead:', err);
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
  signature: {
    position: 'absolute',
    alignItems: 'flex-end',
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
    fontFamily: 'DancingScript_700Bold',
    color: colors.white,
  },
  shadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.95)',
  },
});
