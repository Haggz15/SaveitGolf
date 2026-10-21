import { requireOptionalNativeModule } from 'expo';

// Burns a transparent PNG overlay into every frame of a local video:
//   getVideoSize(uri) -> { width, height } in display orientation (pixels)
//   stamp(videoUri, overlayUri) -> file:// URI of the watermarked MP4
// Null on web, and on store builds made before this module existed (an OTA
// update can still reach those), so callers must fall back to the original.
export default requireOptionalNativeModule('VideoWatermark');
