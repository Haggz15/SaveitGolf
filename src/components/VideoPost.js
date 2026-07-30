import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export default function VideoPost({ source, isActive }) {
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

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      playsInline
    />
  );
}
