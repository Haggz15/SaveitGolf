import { Image } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

const MAX_DIMENSION = 1920;

function getImageSize(uri) {
  return new Promise((resolve, reject) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), reject);
  });
}

// Downsizes and recompresses a picked/taken photo before it's uploaded —
// caps the long edge at 1920px (plenty for both the feed and the scorecard
// share export) and re-encodes as JPEG at 85% quality, which in practice
// looks identical to the original while cutting file size by 40-90%. Falls
// back to the original uri if manipulation fails for any reason, so a
// compression hiccup never blocks the upload itself.
export async function compressImage(uri) {
  try {
    // Resize by whichever side is the long edge — most phone photos are
    // portrait, so a bare `resize: { width: 1920 }` would actually upscale
    // (and blur) a photo that's already narrower than that. Only resize at
    // all once the long edge exceeds the cap.
    let actions = [];
    try {
      const { width, height } = await getImageSize(uri);
      const longEdge = Math.max(width, height);
      if (longEdge > MAX_DIMENSION) {
        actions = width >= height ? [{ resize: { width: MAX_DIMENSION } }] : [{ resize: { height: MAX_DIMENSION } }];
      }
    } catch (sizeErr) {
      // Couldn't read dimensions up front — fall back to a width-based
      // resize rather than skipping compression outright.
      actions = [{ resize: { width: MAX_DIMENSION } }];
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (err) {
    console.error('Image compression error:', err);
    return uri;
  }
}
