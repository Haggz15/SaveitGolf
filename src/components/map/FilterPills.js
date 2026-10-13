import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import colors from '../../theme/colors';
import { MAP_FILTERS, NEAR_ME_RADIUS_MILES } from '../../hooks/useCourseMapData';

const PILLS = [
  { value: MAP_FILTERS.NEAR, label: 'Courses Near Me' },
  { value: MAP_FILTERS.PLAYED, label: 'Courses Played' },
];

// `nearMeCount`/`nearMeLoading` drive the small count shown beside the pills
// while "Courses Near Me" is active.
export default function FilterPills({ value, onChange, nearMeCount = 0, nearMeLoading = false }) {
  return (
    <View style={styles.row}>
      {PILLS.map((pill) => {
        const active = value === pill.value;
        return (
          <TouchableOpacity
            key={pill.value}
            style={[styles.pill, active && styles.pillActive]}
            onPress={() => onChange(pill.value)}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{pill.label}</Text>
          </TouchableOpacity>
        );
      })}
      {value === MAP_FILTERS.NEAR && (
        <View style={styles.nearCount}>
          {nearMeLoading ? (
            <ActivityIndicator size="small" color={colors.muted} />
          ) : (
            <Text style={styles.nearCountText} numberOfLines={1}>
              {nearMeCount} {nearMeCount === 1 ? 'course' : 'courses'} within {NEAR_ME_RADIUS_MILES} mi
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  pillActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  pillText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.white,
  },
  nearCount: {
    flex: 1,
    alignItems: 'flex-end',
  },
  nearCountText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
});
