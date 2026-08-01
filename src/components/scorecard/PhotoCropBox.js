import { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, PanResponder, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import CroppedPhoto from './CroppedPhoto';

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.35;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function touchDistance(touches) {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

// Tall narrow photo slot for the scorecard. Empty state is a tappable dashed
// box; once a photo is set it fills the box (cover) and becomes draggable
// (pan) and pinch/button-zoomable — the resulting `crop` value is box-size
// independent (see CroppedPhoto) so it reproduces correctly in the bigger
// share-image export.
export default function PhotoCropBox({ photo, crop, onCropChange, onRequestPhoto, style }) {
  const [boxSize, setBoxSize] = useState(null);
  const gesture = useRef({}).current;

  const handleLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setBoxSize({ width, height });
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(photo?.uri),
      onMoveShouldSetPanResponder: () => Boolean(photo?.uri),
      onPanResponderGrant: (evt) => {
        gesture.startPanX = crop.panX;
        gesture.startPanY = crop.panY;
        gesture.startZoom = crop.zoom;
        gesture.startDistance = evt.nativeEvent.touches.length === 2 ? touchDistance(evt.nativeEvent.touches) : null;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (!boxSize || !photo?.width) return;
        const touches = evt.nativeEvent.touches;

        let zoom = gesture.startZoom;
        if (touches.length === 2 && gesture.startDistance) {
          zoom = clamp(gesture.startZoom * (touchDistance(touches) / gesture.startDistance), MIN_ZOOM, MAX_ZOOM);
        }

        const baseScale = Math.max(boxSize.width / photo.width, boxSize.height / photo.height);
        const scale = baseScale * zoom;
        const dispW = photo.width * scale;
        const dispH = photo.height * scale;
        const rangeX = Math.min(0, boxSize.width - dispW);
        const rangeY = Math.min(0, boxSize.height - dispH);

        const panX = rangeX === 0 ? 0.5 : clamp(gesture.startPanX + gestureState.dx / rangeX, 0, 1);
        const panY = rangeY === 0 ? 0.5 : clamp(gesture.startPanY + gestureState.dy / rangeY, 0, 1);

        onCropChange({ zoom, panX, panY });
      },
    })
  ).current;

  function adjustZoom(delta) {
    onCropChange({ ...crop, zoom: clamp(crop.zoom + delta, MIN_ZOOM, MAX_ZOOM) });
  }

  if (!photo?.uri) {
    return (
      <TouchableOpacity style={[styles.box, styles.empty, style]} onPress={onRequestPhoto} activeOpacity={0.8}>
        <Ionicons name="camera-outline" size={20} color={colors.muted} />
        <Text style={styles.addText}>Add{'\n'}Photo</Text>
        <Text style={styles.hintText}>Tap to crop</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.box, style]} onLayout={handleLayout} {...panResponder.panHandlers}>
      <CroppedPhoto photo={photo} crop={crop} />

      <TouchableOpacity
        style={styles.replaceButton}
        onPress={onRequestPhoto}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="camera" size={12} color={colors.white} />
      </TouchableOpacity>

      <View style={styles.zoomControls}>
        <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(-ZOOM_STEP)}>
          <Ionicons name="remove" size={12} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={() => adjustZoom(ZOOM_STEP)}>
          <Ionicons name="add" size={12} color={colors.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 90,
    height: '100%',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.navyLight,
    position: 'relative',
  },
  empty: {
    borderWidth: 1.5,
    borderColor: colors.navyBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  addText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 12,
  },
  hintText: {
    color: colors.muted,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 5,
    opacity: 0.8,
  },
  replaceButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(13, 31, 60, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomControls: {
    position: 'absolute',
    bottom: 5,
    alignSelf: 'center',
    flexDirection: 'row',
    backgroundColor: 'rgba(13, 31, 60, 0.75)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  zoomButton: {
    width: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
