import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import colors from '../../theme/colors';

const MIN_CROP_SIZE = 48;
const HANDLE_SIZE = 28;
const CORNERS = ['tl', 'tr', 'bl', 'br'];

function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// expo-image-manipulator only reads local files, and a saved scorecard
// photo is a remote R2 URL — copy it into the cache first.
async function toLocalUri(uri) {
  if (!/^https?:/i.test(uri)) return uri;
  const { File, Paths } = require('expo-file-system');
  const dest = new File(Paths.cache, `scorecard-crop-${Date.now()}.jpg`);
  const file = await File.downloadFileAsync(uri, dest);
  return file.uri;
}

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

// Moves one corner of `start` by (dx, dy), keeping the opposite corner
// fixed, the rect inside the displayed image, and both sides at least
// MIN_CROP_SIZE.
function resizeFromCorner(start, corner, dx, dy, bounds) {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;
  if (corner.includes('l')) left = clamp(left + dx, 0, right - MIN_CROP_SIZE);
  if (corner.includes('r')) right = clamp(right + dx, left + MIN_CROP_SIZE, bounds.w);
  if (corner.includes('t')) top = clamp(top + dy, 0, bottom - MIN_CROP_SIZE);
  if (corner.includes('b')) bottom = clamp(bottom + dy, top + MIN_CROP_SIZE, bounds.h);
  return { x: left, y: top, w: right - left, h: bottom - top };
}

// Native crop tool for a scorecard photo that's already attached (tap the
// photo on the card). Drag inside the box to move it, drag a corner to
// resize; "Crop" bakes the crop into a new JPEG via expo-image-manipulator
// and hands its local uri to onConfirm. Web uses WebPhotoCropModal's
// reposition instead (no pixel crop there).
export default function PhotoCropModal({ visible, uri, onCancel, onConfirm, onChooseDifferent }) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [source, setSource] = useState(null); // { uri, width, height } of the local copy
  const [loadError, setLoadError] = useState(false);
  const [cropping, setCropping] = useState(false);
  const [rect, setRect] = useState(null);
  const rectRef = useRef(null);
  const startRef = useRef(null);
  const boundsRef = useRef({ w: 0, h: 0 });

  const maxW = screenWidth - 40;
  const maxH = screenHeight * 0.6;
  const scale = source ? Math.min(maxW / source.width, maxH / source.height) : 1;
  const display = source ? { w: source.width * scale, h: source.height * scale } : { w: 0, h: 0 };
  boundsRef.current = display;

  function updateRect(next) {
    rectRef.current = next;
    setRect(next);
  }

  useEffect(() => {
    if (!visible || !uri) return undefined;
    let cancelled = false;
    setSource(null);
    setLoadError(false);
    setRect(null);
    (async () => {
      try {
        const localUri = await toLocalUri(uri);
        const size = await getImageSize(localUri);
        if (!cancelled) setSource({ uri: localUri, ...size });
      } catch (err) {
        console.error('Failed to load photo for cropping:', err);
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, uri]);

  // Start with the crop box covering the whole photo.
  useEffect(() => {
    if (source) updateRect({ x: 0, y: 0, w: display.w, h: display.h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, display.w, display.h]);

  const movePan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startRef.current = rectRef.current;
      },
      onPanResponderMove: (_, { dx, dy }) => {
        const start = startRef.current;
        const bounds = boundsRef.current;
        if (!start) return;
        updateRect({
          ...start,
          x: clamp(start.x + dx, 0, bounds.w - start.w),
          y: clamp(start.y + dy, 0, bounds.h - start.h),
        });
      },
    })
  ).current;

  const cornerPans = useRef(
    Object.fromEntries(
      CORNERS.map((corner) => [
        corner,
        PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderTerminationRequest: () => false,
          onPanResponderGrant: () => {
            startRef.current = rectRef.current;
          },
          onPanResponderMove: (_, { dx, dy }) => {
            if (!startRef.current) return;
            updateRect(resizeFromCorner(startRef.current, corner, dx, dy, boundsRef.current));
          },
        }),
      ])
    )
  ).current;

  async function handleCrop() {
    if (!source || !rect) return;
    setCropping(true);
    try {
      const originX = Math.round(rect.x / scale);
      const originY = Math.round(rect.y / scale);
      const crop = {
        originX,
        originY,
        width: Math.min(Math.round(rect.w / scale), source.width - originX),
        height: Math.min(Math.round(rect.h / scale), source.height - originY),
      };
      const result = await ImageManipulator.manipulateAsync(source.uri, [{ crop }], {
        compress: 1,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      onConfirm(result.uri);
    } catch (err) {
      console.error('Failed to crop scorecard photo:', err);
      Alert.alert('Something went wrong', 'Could not crop your photo. Please try again.');
    } finally {
      setCropping(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Text style={styles.title}>Crop Photo</Text>
        <Text style={styles.subtitle}>Drag the box to move it, drag a corner to resize</Text>

        {loadError ? (
          <Text style={styles.subtitle}>Couldn't load this photo.</Text>
        ) : !source || !rect ? (
          <ActivityIndicator color={colors.white} style={{ height: 120 }} />
        ) : (
          <View style={{ width: display.w, height: display.h }}>
            <Image source={{ uri: source.uri }} style={{ width: display.w, height: display.h }} />

            {/* Dims everything outside the crop box. */}
            <View pointerEvents="none" style={[styles.shade, { left: 0, right: 0, top: 0, height: rect.y }]} />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: 0, right: 0, top: rect.y + rect.h, bottom: 0 }]}
            />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: 0, width: rect.x, top: rect.y, height: rect.h }]}
            />
            <View
              pointerEvents="none"
              style={[styles.shade, { left: rect.x + rect.w, right: 0, top: rect.y, height: rect.h }]}
            />

            <View
              {...movePan.panHandlers}
              style={[styles.cropBox, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
            >
              {CORNERS.map((corner) => (
                <View
                  key={corner}
                  {...cornerPans[corner].panHandlers}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  style={[
                    styles.handle,
                    corner.includes('t') ? { top: -HANDLE_SIZE / 2 } : { bottom: -HANDLE_SIZE / 2 },
                    corner.includes('l') ? { left: -HANDLE_SIZE / 2 } : { right: -HANDLE_SIZE / 2 },
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton} activeOpacity={0.8} disabled={cropping}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleCrop}
            style={[styles.confirmButton, (!rect || cropping) && styles.disabled]}
            activeOpacity={0.8}
            disabled={!rect || cropping}
          >
            {cropping ? (
              <ActivityIndicator size="small" color={colors.brightGreenText} />
            ) : (
              <Text style={styles.confirmButtonText}>Crop</Text>
            )}
          </TouchableOpacity>
        </View>

        {onChooseDifferent && (
          <TouchableOpacity onPress={onChooseDifferent} disabled={cropping} style={styles.chooseDifferent}>
            <Text style={styles.chooseDifferentText}>Choose a different photo</Text>
          </TouchableOpacity>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 15,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 20,
  },
  shade: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.brightGreen,
  },
  handle: {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    borderRadius: HANDLE_SIZE / 2,
    backgroundColor: colors.brightGreen,
    borderWidth: 2,
    borderColor: colors.white,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    padding: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  confirmButton: {
    minWidth: 96,
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: colors.brightGreen,
  },
  confirmButtonText: {
    color: colors.brightGreenText,
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  chooseDifferent: {
    marginTop: 18,
    padding: 8,
  },
  chooseDifferentText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});
