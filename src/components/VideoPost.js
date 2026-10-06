import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

// `muted`/`setMuted` are lifted to the feed screen (see FeedScreen.js's
// isMuted state) so toggling sound on one post applies to every other video
// in the feed, not just this one.
//
// Tap-to-pause is handled by the parent slide (VideoView absorbs touches, so
// a touchable in here never fires): it owns `userPaused` and calls
// `onTap.current`, which this component sets to its icon-flash animation.
export default function VideoPost({ source, isActive, muted, setMuted, userPaused = false, onTap }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = muted;
  });

  useEffect(() => {
    const statusSubscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') {
        console.error('Video failed to load:', source, error);
      }
    });

    return () => statusSubscription.remove();
  }, [player, source]);

  const [feedbackIcon, setFeedbackIcon] = useState('pause');
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const userPausedRef = useRef(userPaused);
  userPausedRef.current = userPaused;

  // The parent toggles userPaused in the same tap, so the icon reflects the
  // state being entered: pausing shows "pause", resuming shows "play".
  useEffect(() => {
    if (!onTap) return undefined;
    onTap.current = () => {
      setFeedbackIcon(userPausedRef.current ? 'play' : 'pause');
      feedbackOpacity.stopAnimation();
      feedbackOpacity.setValue(1);
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 600,
        delay: 250,
        useNativeDriver: true,
      }).start();
    };
    return () => {
      onTap.current = null;
    };
  }, [onTap, feedbackOpacity]);

  // Only the currently visible post should play. This keeps every other
  // mounted video paused so it isn't buffering or decoding in the background.
  useEffect(() => {
    if (isActive && !userPaused) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, userPaused, player]);

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
      <Animated.View style={[styles.tapFeedback, { opacity: feedbackOpacity }]} pointerEvents="none">
        <View style={styles.tapFeedbackCircle}>
          <Ionicons name={feedbackIcon} size={36} color={colors.white} />
        </View>
      </Animated.View>
      <TouchableOpacity
        style={styles.speakerButton}
        onPress={() => setMuted(!muted)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.75}
      >
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={14} color={colors.white} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  tapFeedback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapFeedbackCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(6, 14, 26, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
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
