import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

export function MapWarningBanner({ icon, children }) {
  return (
    <View style={styles.warningBanner}>
      <Ionicons name={icon} size={14} color={colors.gold} />
      <Text style={styles.warningText}>{children}</Text>
    </View>
  );
}

export function MapLoadingBanner({ children }) {
  return (
    <View style={styles.loadingBanner}>
      <ActivityIndicator size="small" color={colors.red} />
      <Text style={styles.loadingBannerText}>{children}</Text>
    </View>
  );
}

// Countdown pill shown while the feed's course-name-tap flow is about to
// auto-navigate to Course Detail (see useCourseMapData's courseAutoNavigate)
// — tapping it anywhere skips straight there instead of waiting it out.
export function MapAutoNavigateCountdown({ secondsLeft, onPress }) {
  return (
    <TouchableOpacity style={styles.countdownPill} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.countdownPillText}>Opening course page in {secondsLeft}…</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  warningText: {
    color: colors.muted,
    fontSize: 11,
    flex: 1,
  },
  loadingBanner: {
    position: 'absolute',
    top: 12,
    zIndex: 1000,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  loadingBannerText: {
    color: colors.muted,
    fontSize: 12,
  },
  countdownPill: {
    position: 'absolute',
    bottom: 20,
    zIndex: 1000,
    alignSelf: 'center',
    backgroundColor: '#0d1f3c',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
  },
  countdownPillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
