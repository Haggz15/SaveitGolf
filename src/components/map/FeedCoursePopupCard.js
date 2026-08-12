import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Shown at the bottom of the map once the feed's course-name-tap flow drops
// its flag pin (see useCourseMapData's feedCoursePopup) — stays visible
// indefinitely until the user taps its button or taps elsewhere on the map
// to dismiss it (MapScreen/MapScreen.web's MapView onPress).
export default function FeedCoursePopupCard({ course, onViewHoles }) {
  const location = [course.city, course.state].filter(Boolean).join(', ');

  return (
    <View style={styles.popupCard}>
      <Text style={styles.courseName} numberOfLines={2}>
        {course.courseName}
      </Text>
      {!!location && (
        <Text style={styles.location} numberOfLines={1}>
          {location}
        </Text>
      )}
      <TouchableOpacity style={styles.button} onPress={onViewHoles} activeOpacity={0.85}>
        <Text style={styles.buttonText}>View Holes and Shots</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  popupCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    zIndex: 1000,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 16,
    padding: 16,
  },
  courseName: {
    fontFamily: 'Cinzel_700Bold',
    color: colors.white,
    fontSize: 16,
    marginBottom: 4,
  },
  location: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c0001a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
