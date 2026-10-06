import { useState } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// my_courses has no "date played" column — created_at (when the course was
// added to Courses Played) is the closest thing, so it's labeled "Added".
function formatAddedDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// Top-right "Played X courses" pill on the map. Courses come from the same
// my_courses list useCourseMapData already loads (and refetches on focus),
// so it never drifts from the Courses Played pins. Tapping the pill toggles
// a dropdown listing those courses; tapping anywhere else on the map closes it.
export default function CoursesPlayedBadge({ courses }) {
  const [open, setOpen] = useState(false);
  const count = courses?.length ?? 0;
  if (!count) return null;

  return (
    <>
      {open && <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => setOpen(false)} />}
      <TouchableOpacity style={styles.badge} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <Image source={require('../../../assets/icon.png')} style={styles.logo} />
        <Text style={styles.text}>
          Played {count} {count === 1 ? 'course' : 'courses'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.white} style={styles.chevron} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dropdown}>
          <ScrollView>
            {courses.map((course, index) => {
              const added = formatAddedDate(course.addedAt);
              const location = [course.city, course.state].filter(Boolean).join(', ');
              return (
                <View key={`${course.id}-${index}`} style={[styles.row, index > 0 && styles.rowDivider]}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {course.name}
                  </Text>
                  {(location || added) && (
                    <Text style={styles.rowMeta} numberOfLines={1}>
                      {[location, added && `Added ${added}`].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}
    </>
  );
}

// Height of the pill plus a gap — ZoomControls shifts down by this much
// while the badge is showing so the two don't overlap.
export const COURSES_PLAYED_BADGE_OFFSET = 44;

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 12,
    right: 16,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13,31,60,0.85)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingLeft: 6,
    paddingVertical: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  logo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    zIndex: 999,
  },
  chevron: {
    marginLeft: 4,
  },
  dropdown: {
    position: 'absolute',
    top: 12 + COURSES_PLAYED_BADGE_OFFSET - 4,
    right: 16,
    zIndex: 1001,
    width: 260,
    maxHeight: 320,
    backgroundColor: colors.navyCard,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 4,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  row: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rowDivider: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  rowName: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  rowMeta: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
});
