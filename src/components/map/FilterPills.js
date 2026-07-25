import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';
import { MAP_FILTERS } from '../../hooks/useCourseMapData';

const PILLS = [
  { value: MAP_FILTERS.ALL, label: 'All Courses' },
  { value: MAP_FILTERS.PLAYED, label: "Courses I've Played" },
];

export default function FilterPills({ value, onChange }) {
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
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
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
});
