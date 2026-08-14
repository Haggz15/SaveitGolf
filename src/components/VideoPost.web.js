import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAssetByID } from '@react-native/assets-registry/registry';
import colors from '../theme/colors';

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
  const [muted, setMuted] = useState(true);
  const asset = isMobileDevice() && mobileSource ? mobileSource : source;
  const uri = resolveWebAssetUri(asset);

  // React doesn't recognize a `defaultMuted` JSX prop on <video> in this
  // setup (it warns and drops it), so the initial autoplay-compliant muted
  // state is set imperatively here, the same way toggling is — via a plain
  // ref assignment, never a JSX `muted` attribute.
  const setVideoRef = (node) => {
    videoRef.current = node;
    if (node) node.muted = true;
  };

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

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  return (
    <>
      <video
        ref={setVideoRef}
        style={{ ...StyleSheet.absoluteFillObject, width: '100%', height: '100%', objectFit: 'cover' }}
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
      <TouchableOpacity
        style={styles.speakerButton}
        onPress={() => setMuted((prev) => !prev)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.75}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color={colors.white} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  speakerButton: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
