import { useCallback, useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Renders `photo` cover-fit inside whatever box it's laid out in, combining
// `crop.zoom` (multiplier over the base cover scale) with `crop.panX` /
// `crop.panY` (0..1 fraction across the available pan range). The crop value
// is box-size independent, so the same value reproduces the same framing in
// both the small on-screen preview box and the much larger share-image
// export half — only the box's own onLayout measurement differs.
export default function CroppedPhoto({ photo, crop, style }) {
  const [box, setBox] = useState(null);

  const handleLayout = useCallback((e) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  }, []);

  let imageStyle = null;
  if (box && box.width > 0 && box.height > 0 && photo?.width && photo?.height) {
    const zoom = clamp(crop?.zoom ?? 1, 1, 10);
    const panX = clamp(crop?.panX ?? 0.5, 0, 1);
    const panY = clamp(crop?.panY ?? 0.5, 0, 1);
    const baseScale = Math.max(box.width / photo.width, box.height / photo.height);
    const scale = baseScale * zoom;
    const dispW = photo.width * scale;
    const dispH = photo.height * scale;
    const minLeft = Math.min(0, box.width - dispW);
    const minTop = Math.min(0, box.height - dispH);
    imageStyle = { position: 'absolute', width: dispW, height: dispH, left: minLeft * panX, top: minTop * panY };
  }

  return (
    <View style={[styles.wrap, style]} onLayout={handleLayout}>
      {photo?.uri && imageStyle && <Image source={{ uri: photo.uri }} style={imageStyle} resizeMode="cover" />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
});
