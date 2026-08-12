import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Shared bottom sheet for a tapped course row (Course Rankings or Courses
// Played, on either the user's own profile or another user's) — offers the
// same two destinations the map's own course-detail popup does: jump to the
// course on the Map (see utils/courseNavigation.navigateToCourseOnMap) or go
// straight to its Course Detail page.
export default function CourseActionSheet({ visible, course, onClose, onViewMap, onViewCourseDetail }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title} numberOfLines={1}>
            {course?.courseName}
          </Text>

          <TouchableOpacity style={styles.option} onPress={onViewMap} activeOpacity={0.8}>
            <Ionicons name="map-outline" size={20} color={colors.white} />
            <Text style={styles.optionText}>View on Map</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.viewHolesButton} onPress={onViewCourseDetail} activeOpacity={0.8}>
            <Ionicons name="golf-outline" size={16} color={colors.white} />
            <Text style={styles.viewHolesButtonText}>View Holes and Shots</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.navyCard,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderColor: colors.navyBorder,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
    marginBottom: 14,
  },
  title: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  optionText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  viewHolesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#c0001a',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  viewHolesButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  cancelButton: {
    marginTop: 14,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.navy,
    alignItems: 'center',
  },
  cancelText: {
    color: colors.offWhite,
    fontSize: 14,
    fontWeight: '700',
  },
});
