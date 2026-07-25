import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// golfcourseapi.com has no public/private field, so this is a best-effort
// guess from the course name — "Country Club" is a strong private signal,
// everything else defaults to public.
function guessAccess(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('country club') || lower.includes('private')) return 'Private';
  return 'Public';
}

export default function CoursePopupCard({ course, detail, onClose, onViewHoles }) {
  return (
    <View style={styles.popupCard}>
      <TouchableOpacity style={styles.popupClose} onPress={onClose}>
        <Ionicons name="close" size={18} color={colors.muted} />
      </TouchableOpacity>
      <Text style={styles.popupName}>{course.name}</Text>
      <Text style={styles.popupLocation}>
        {course.city}, {course.state}
      </Text>

      <View style={styles.popupMetaRow}>
        <View style={styles.popupMetaItem}>
          <Text style={styles.popupMetaLabel}>Access</Text>
          <Text style={styles.popupMetaValue}>{guessAccess(course.name)}</Text>
        </View>
        <View style={styles.popupMetaItem}>
          <Text style={styles.popupMetaLabel}>Holes</Text>
          {detail?.loading ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <Text style={styles.popupMetaValue}>{detail?.holes ?? detail?.error ?? '—'}</Text>
          )}
        </View>
      </View>
      <Text style={styles.popupNote}>Access is estimated from the course name, not confirmed data.</Text>

      <TouchableOpacity style={styles.popupButton} onPress={onViewHoles}>
        <Text style={styles.popupButtonText}>View holes & shots</Text>
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
    fontSize: 16,
    fontWeight: '700',
    marginRight: 24,
  },
  popupLocation: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  popupMetaRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    marginBottom: 6,
  },
  popupMetaItem: {
    flex: 1,
  },
  popupMetaLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  popupMetaValue: {
    color: colors.offWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  popupNote: {
    color: colors.muted,
    fontSize: 10,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  popupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  popupButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
