import { Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Opt-in trigger for loading every course in the state currently in view —
// course data for a state is never fetched just from zooming/panning into
// it, only from tapping this button.
export default function BrowseAllButton({ stateName, loading, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.button, loading && styles.buttonLoading]}
      onPress={onPress}
      disabled={loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.white} />
      ) : (
        <Ionicons name="golf" size={16} color={colors.white} />
      )}
      <Text style={styles.buttonText}>
        {loading ? `Loading ${stateName} courses…` : `Browse All ${stateName} Courses`}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.green,
    gap: 8,
  },
  buttonLoading: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.green,
  },
  buttonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
