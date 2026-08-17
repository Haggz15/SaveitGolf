import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Two pill buttons ("Side" / "Behind") shown above the scorecard card once a
// photo is attached (Fix 2) — picks which of ScorecardCard's two photo
// layouts is rendered. Hidden entirely by the caller when there's no photo,
// and during a share capture via `hidden` (it always lives outside the
// captured card element already, so this is just for a clean fade rather
// than strictly necessary for the exported image).
export default function PhotoLayoutToggle({ layout, onChange, hidden }) {
  if (hidden) return null;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => onChange('side')}
        style={[styles.pill, layout === 'side' ? styles.pillActive : styles.pillInactive]}
        activeOpacity={0.85}
      >
        <Text style={styles.pillText}>Side</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => onChange('behind')}
        style={[styles.pill, layout === 'behind' ? styles.pillActive : styles.pillInactive]}
        activeOpacity={0.85}
      >
        <Text style={styles.pillText}>Behind</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignSelf: 'center',
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  pillActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  pillInactive: {
    backgroundColor: '#1a2e4a',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
