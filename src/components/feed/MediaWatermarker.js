import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';

// Cap the offscreen render at this width so a huge original photo doesn't
// blow up memory/capture time — still far above what the camera roll needs.
const MAX_DIMENSION = 1440;

// Off-screen (native-only) capture rig for Fix 3: renders a post's image at
// roughly its native resolution with the SaveitGolf watermark pill baked
// into the top-right corner, then hands back a local file URI ready to save
// to the camera roll. Mount once per screen and call
// `ref.current.capture(mediaUrl)`. Web doesn't need this — canvas
// compositing there is cheap and keeps full original resolution (see
// saveImageWithWatermarkWeb in utils/saveMedia.js).
const MediaWatermarker = forwardRef(function MediaWatermarker(_props, ref) {
  const shotRef = useRef(null);
  const [target, setTarget] = useState(null); // { uri, width, height }

  useImperativeHandle(ref, () => ({
    capture(mediaUrl) {
      return new Promise((resolve, reject) => {
        Image.getSize(
          mediaUrl,
          async (naturalWidth, naturalHeight) => {
            try {
              const scale = Math.min(1, MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
              const width = Math.round(naturalWidth * scale);
              const height = Math.round(naturalHeight * scale);
              setTarget({ uri: mediaUrl, width, height });
              // Two RAFs: the first lets the state update commit, the
              // second lets the image + pill actually paint before ViewShot
              // reads pixels off the view.
              await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
              const uri = await shotRef.current.capture();
              setTarget(null);
              resolve(uri);
            } catch (err) {
              setTarget(null);
              reject(err);
            }
          },
          reject
        );
      });
    },
  }));

  if (!target) return null;

  const fontSize = Math.max(16, target.width * 0.045);

  return (
    <View style={[styles.offscreen, { width: target.width, height: target.height }]} pointerEvents="none">
      <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 1 }}>
        <View style={{ width: target.width, height: target.height }}>
          <Image source={{ uri: target.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={[styles.pill, { top: target.width * 0.05, right: target.width * 0.05 }]}>
            <Text style={{ fontFamily: 'DancingScript_700Bold', fontSize, color: '#ffffff' }}>
              Save it<Text style={{ color: '#c0001a' }}> Golf</Text>
            </Text>
          </View>
        </View>
      </ViewShot>
    </View>
  );
});

const styles = StyleSheet.create({
  offscreen: {
    position: 'absolute',
    top: -20000,
    left: 0,
  },
  pill: {
    position: 'absolute',
    backgroundColor: 'rgba(13,31,60,0.7)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
});

export default MediaWatermarker;
