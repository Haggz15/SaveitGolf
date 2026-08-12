import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { courseDetail as mockCourseDetail } from '../../data/mockData';

// golfcourseapi.com has no rating/post-count field, so — same as the Course
// Detail screen — these come from the shared mock fixture until real
// per-course SaveitGolf activity data exists.
function buildMetaLine(course, detail) {
  const location = [course.city, course.state].filter(Boolean).join(', ');
  const segments = [];
  if (location) segments.push(location);
  if (detail?.holes != null) segments.push(`${detail.holes} Holes`);
  if (detail?.par != null) segments.push(`Par ${detail.par}`);
  if (!detail?.loading && detail?.error && detail?.holes == null) segments.push(detail.error);
  return segments.join(' · ');
}

export default function CoursePopupCard({ course, detail, onClose, onViewHoles }) {
  const metaLine = buildMetaLine(course, detail);

  return (
    <View style={styles.popupCard}>
      <TouchableOpacity style={styles.popupClose} onPress={onClose}>
        <Ionicons name="close" size={18} color={colors.muted} />
      </TouchableOpacity>
      <Text style={styles.popupName}>{course.name}</Text>

      <View style={styles.metaRow}>
        {!!metaLine && <Text style={styles.popupMeta}>{metaLine}</Text>}
        {detail?.loading && (
          <ActivityIndicator size="small" color={colors.muted} style={styles.metaSpinner} />
        )}
      </View>

      <View style={styles.ratingRow}>
        <Ionicons name="star" size={14} color={colors.gold} />
        <Text style={styles.ratingValue}>{mockCourseDetail.rating}</Text>
        <Text style={styles.ratingDivider}>·</Text>
        <Text style={styles.ratingPosts}>{mockCourseDetail.postsCount} posts</Text>
      </View>

      {detail?.nines?.length > 0 && (
        <View style={styles.ninesRow}>
          <Ionicons name="flag-outline" size={12} color={colors.lightBlue} />
          <Text style={styles.ninesText} numberOfLines={1}>
            Posts tagged: {detail.nines.join(', ')}
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.popupButton} onPress={onViewHoles}>
        <Text style={styles.popupButtonText}>View Holes and Shots</Text>
        <Ionicons name="arrow-forward" size={16} color={colors.white} />
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
  popupClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  popupName: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginRight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  popupMeta: {
    color: colors.muted,
    fontSize: 13,
  },
  metaSpinner: {
    marginLeft: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 14,
  },
  ratingValue: {
    color: colors.offWhite,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingDivider: {
    color: colors.muted,
    fontSize: 13,
  },
  ratingPosts: {
    color: colors.muted,
    fontSize: 13,
  },
  ninesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  ninesText: {
    flex: 1,
    color: colors.lightBlue,
    fontSize: 12,
    fontStyle: 'italic',
  },
  popupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c0001a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  popupButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
});
