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
// compression hiccup never blocks the upload itself. `maxDimension` and
// `quality` override the defaults for smaller targets like avatars.
export async function compressImage(uri, { maxDimension = MAX_DIMENSION, quality = 0.85 } = {}) {
  try {
    // Resize by whichever side is the long edge — most phone photos are
    // portrait, so a bare `resize: { width: 1920 }` would actually upscale
    // (and blur) a photo that's already narrower than that. Only resize at
    // all once the long edge exceeds the cap.
    let actions = [];
    try {
      const { width, height } = await getImageSize(uri);
      const longEdge = Math.max(width, height);
      if (longEdge > maxDimension) {
        actions = width >= height ? [{ resize: { width: maxDimension } }] : [{ resize: { height: maxDimension } }];
      }
    } catch (sizeErr) {
      // Couldn't read dimensions up front — fall back to a width-based
      // resize rather than skipping compression outright.
      actions = [{ resize: { width: maxDimension } }];
    }

    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return result.uri;
  } catch (err) {
    console.error('Image compression error:', err);
    return uri;
  }
}
