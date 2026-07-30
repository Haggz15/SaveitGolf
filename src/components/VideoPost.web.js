import { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { getAssetByID } from '@react-native/assets-registry/registry';

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
}

// Metro's web export resolves require('*.mp4') straight to a string URI,
// but the numeric asset-registry ID form (used in dev / other Metro configs)
// can still show up, so handle both without touching react-native's
// resolveAssetSource, which pulls in a native-bridge-only module
// (NativeSourceCode) that throws when there's no bridge on web.
function resolveWebAssetUri(source) {
  if (source == null) return undefined;
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && typeof source.uri === 'string') return source.uri;

  const asset = getAssetByID(source);
  if (!asset) return undefined;
  const type = asset.type ? `.${asset.type}` : '';
  const path = __DEV__
    ? `${asset.httpServerLocation}/${asset.name}${type}`
    : `${asset.httpServerLocation.replace(/\.\.\//g, '_')}/${asset.name}${type}`;
  return new URL(path, window.location.origin).toString();
}

export default function VideoPost({ source, mobileSource, isActive }) {
  const videoRef = useRef(null);
  const asset = isMobileDevice() && mobileSource ? mobileSource : source;
  const uri = resolveWebAssetUri(asset);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isActive) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } else {
      video.pause();
    }
  }, [isActive, uri]);

  return (
    <video
      ref={videoRef}
      style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', objectFit: 'cover' }}
      muted
      loop
      playsInline
      webkit-playsinline="true"
      x-webkit-airplay="deny"
      preload="auto"
      disablePictureInPicture
      controls={false}
      onError={() => console.error('Video failed to load:', asset)}
    >
      <source src={uri} type="video/mp4" />
    </video>
  );
}
