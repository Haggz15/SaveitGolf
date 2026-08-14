import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function VideoPost({ source, isActive }) {
  const [muted, setMuted] = useState(true);
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    setVideoLoading(true);
    setVideoError(false);
  }, [source]);

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.error('Video load error:', source, error);
        setVideoLoading(false);
        setVideoError(true);
      } else if (status === 'readyToPlay') {
        console.log('Video loaded successfully:', source);
        setVideoLoading(false);
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

  if (videoError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }

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
      {videoLoading && (
        <View style={styles.centered} pointerEvents="none">
          <ActivityIndicator color={colors.white} size="small" />
        </View>
      )}
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
  centered: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
  errorText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
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
