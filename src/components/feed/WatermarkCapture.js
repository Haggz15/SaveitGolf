import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Image, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import colors from '../../theme/colors';

// Longest edge of the exported image, in device pixels. Big enough to look
// sharp in the camera roll without making ViewShot rasterise a huge view.
const MAX_EXPORT_EDGE = 2048;
// Bail out if the photo never loads (bad URL, offline) instead of leaving
// the Save button spinning forever.
const LOAD_TIMEOUT_MS = 15000;

function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// Two frames: one for the onLoad state to commit, one for the native image
// layer to actually draw the decoded bitmap before ViewShot reads the view.
function nextFrames() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function GolfBallIcon({ size }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10.5} fill="#ffffff" stroke="rgba(13,31,60,0.25)" strokeWidth={0.75} />
      <Circle cx={8.5} cy={8.5} r={1.1} fill="#c9ccd2" />
      <Circle cx={12.5} cy={7} r={1.1} fill="#c9ccd2" />
      <Circle cx={16} cy={9.5} r={1.1} fill="#c9ccd2" />
      <Circle cx={10} cy={12.5} r={1.1} fill="#c9ccd2" />
      <Circle cx={14} cy={13} r={1.1} fill="#c9ccd2" />
      <Circle cx={7.5} cy={15.5} r={1.1} fill="#c9ccd2" />
      <Circle cx={11.5} cy={16.5} r={1.1} fill="#c9ccd2" />
      <Circle cx={15.5} cy={16.5} r={1.1} fill="#c9ccd2" />
    </Svg>
  );
}

// Mounted once per FeedScreen (never inside FlatList cells) and kept
// off-screen. stamp(uri) renders the photo with a navy "SaveitGolf" pill in
// the bottom-left corner, waits for the Image's onLoad, captures it with
// ViewShot and resolves with the local file URI of the watermarked JPEG.
const WatermarkCapture = forwardRef(function WatermarkCapture(_props, ref) {
  const viewShotRef = useRef(null);
  const [job, setJob] = useState(null); // { id, uri, width, height }
  const pendingRef = useRef(null); // { id, resolve, reject, timer }
  // Serialises stamp() calls — there's only one off-screen canvas.
  const queueRef = useRef(Promise.resolve());
  const jobIdRef = useRef(0);

  const finish = useCallback((id, error, result) => {
    const pending = pendingRef.current;
    if (!pending || pending.id !== id) return;
    clearTimeout(pending.timer);
    pendingRef.current = null;
    setJob(null);
    if (error) pending.reject(error);
    else pending.resolve(result);
  }, []);

  const runStamp = useCallback(async (uri) => {
    const natural = await getImageSize(uri);
    const scale = Math.min(1, MAX_EXPORT_EDGE / Math.max(natural.width, natural.height));
    const pixelRatio = PixelRatio.get();
    const width = Math.round(natural.width * scale) / pixelRatio;
    const height = Math.round(natural.height * scale) / pixelRatio;
    const id = ++jobIdRef.current;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => finish(id, new Error('Timed out loading image for watermark')),
        LOAD_TIMEOUT_MS
      );
      pendingRef.current = { id, resolve, reject, timer };
      setJob({ id, uri, width, height });
    });
  }, [finish]);

  useImperativeHandle(ref, () => ({
    stamp(uri) {
      const result = queueRef.current.then(() => runStamp(uri));
      queueRef.current = result.catch(() => {});
      return result;
    },
  }), [runStamp]);

  async function handleLoad(id) {
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

  // Badge scales with the image so it reads the same on any resolution.
  const badgeHeight = Math.max(18, job.width * 0.07);
  const margin = job.width * 0.035;

  return (
    <View style={styles.offscreen} pointerEvents="none">
      <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.92, result: 'tmpfile' }}>
        <View collapsable={false} style={{ width: job.width, height: job.height }}>
          <Image
            key={job.id}
            source={{ uri: job.uri }}
            style={{ width: job.width, height: job.height }}
            resizeMode="cover"
            onLoad={() => handleLoad(job.id)}
            onError={(e) => finish(job.id, new Error(e?.nativeEvent?.error || 'Could not load image'))}
          />
          <View
            style={[
              styles.badge,
              {
                left: margin,
                bottom: margin,
                height: badgeHeight,
                borderRadius: badgeHeight / 2,
                paddingHorizontal: badgeHeight * 0.4,
                gap: badgeHeight * 0.25,
                borderWidth: Math.max(1, badgeHeight * 0.03),
              },
            ]}
          >
            <GolfBallIcon size={badgeHeight * 0.58} />
            <Text style={[styles.badgeText, { fontSize: badgeHeight * 0.52, lineHeight: badgeHeight * 0.7 }]}>
              SaveitGolf
            </Text>
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

export default WatermarkCapture;

// Shared by the feed's Save button and PostShareSheet. Resolves with the
// local URI of a watermarked copy when the post is someone else's photo, or
// null when the original file should be used as-is: videos, the user's own
// posts, web (no ViewShot there), or a failed stamp — a watermark problem
// shouldn't block the save/share itself.
export async function stampPostPhoto({ post, currentUserId, captureRef }) {
  const capture = captureRef?.current;
  const isVideo = post.isVideo ?? Boolean(post.video);
  if (Platform.OS === 'web' || isVideo || !post.mediaUrl || post.userId === currentUserId || !capture) {
    return null;
  }
  try {
    return await capture.stamp(post.mediaUrl);
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
  badge: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 31, 60, 0.72)', // colors.navy at ~70%
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  badgeText: {
    fontFamily: 'DancingScript_700Bold',
    color: colors.white,
  },
});
