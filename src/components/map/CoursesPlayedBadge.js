import { View, Text, StyleSheet } from 'react-native';

// Top-right "Played X courses" pill on the map. Count comes from the same
// my_courses list useCourseMapData already loads (and refetches on focus),
// so it never drifts from the green Courses Played pins.
export default function CoursesPlayedBadge({ count }) {
  if (!count) return null;
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.text}>
        ⛳ Played {count} {count === 1 ? 'course' : 'courses'}
      </Text>
    </View>
  );
}

// Height of the pill plus a gap — ZoomControls shifts down by this much
// while the badge is showing so the two don't overlap.
export const COURSES_PLAYED_BADGE_OFFSET = 40;

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1000,
    backgroundColor: 'rgba(13,31,60,0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});
