import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function VideoPost({ source, isActive }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.error('Video failed to load:', source, error);
      }
    });

    return () => statusSubscription.remove();
  }, [player, source]);

  // Only the currently visible post should play. This keeps every other
  // mounted video paused so it isn't buffering or decoding in the background.
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        contentFit="cover"
        nativeControls={false}
        fullscreenOptions={{ enable: false }}
        playsInline
      />
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
