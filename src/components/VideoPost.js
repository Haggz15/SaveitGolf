import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
const PLAYBACK_RATES = [0.5, 1, 2];

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

  // expo-video has no `rate` prop on VideoView; speed is set on the player.
  const [playbackRate, setPlaybackRate] = useState(1);
  useEffect(() => {
    player.playbackRate = playbackRate;
  }, [playbackRate, player]);

  const cyclePlaybackRate = () => {
    const next = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(playbackRate) + 1) % PLAYBACK_RATES.length];
    setPlaybackRate(next);
  };

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
      {isActive && !userPaused && (
        <TouchableOpacity
          style={styles.speedButton}
          onPress={cyclePlaybackRate}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.75}
        >
          <Text style={styles.speedButtonText}>{playbackRate}x</Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  tapFeedback: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
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
  // Sits in the strip below the feed's caption block (leftInfo, bottom: 45)
  // and above the bottom gradient so it isn't dimmed.
  speedButton: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    zIndex: 6,
  },
  speedButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
