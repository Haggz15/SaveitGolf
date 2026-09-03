import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

function locationLabel(course) {
  return [course.city, course.state].filter(Boolean).join(', ') || 'Location unknown';
}

export default function CourseSearchBar({
  query,
  onChangeQuery,
  onClear,
  results,
  searching,
  onSelectResult,
  placeholder = 'Search courses, cities, states',
  onFocus,
  onBlur,
}) {
  const showDropdown = query.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={onChangeQuery}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          onFocus={onFocus}
          onBlur={onBlur}
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={onClear}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {searching ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.red} />
              <Text style={styles.statusText}>Searching…</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>No courses found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => onSelectResult(item)}>
                  <Ionicons name="flag-outline" size={16} color={colors.red} style={styles.resultIcon} />
                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.resultLocation} numberOfLines={1}>
                      {locationLabel(item)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: colors.navy,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    zIndex: 1000,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    height: '100%',
  },
  clearButton: {
    marginLeft: 8,
  },
  dropdown: {
    position: 'absolute',
    top: 56,
    left: 16,
    right: 16,
    maxHeight: 280,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 1001,
    elevation: 10,
  },
  resultsList: {
    maxHeight: 280,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    gap: 10,
  },
  resultIcon: {
    marginTop: 1,
  },
  resultTextWrap: {
    flex: 1,
  },
  resultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resultLocation: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
  },
});
