import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '../theme/colors';

const DEFAULT_VISIBLE_MS = 2000;

// Small auto-dismissing confirmation toast, scoped to whichever screen
// mounts it — not a global provider. `type` tints the toast green/red for
// success/error confirmations; plain (no type) keeps the neutral navy style.
export default function Toast({ message, onHide, type, duration = DEFAULT_VISIBLE_MS, bottom }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => onHide?.());
    }, duration);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  const tint = type === 'success' ? colors.green : type === 'error' ? colors.red : null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        bottom ? { bottom: insets.bottom + 60 } : { top: insets.top + 60 },
        tint && { backgroundColor: tint, borderColor: tint },
        { opacity },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(13, 31, 60, 0.95)',
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    zIndex: 20,
  },
  text: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
