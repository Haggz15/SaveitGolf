import { View, Text, StyleSheet } from 'react-native';

const GOLD = '#F5E6C8';
const FINALIST_GOLD = '#d4af37';
const NAVY = '#0d1f3c';

// `variant="finalist"` marks one of this week's nominees that hasn't won —
// a brighter gold pill with its own label instead of the winner's.
export default function ShotOfWeekBanner({ variant = 'winner' }) {
  const finalist = variant === 'finalist';
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.banner, finalist && styles.finalistBanner]}>
        <Text style={[styles.text, finalist && styles.finalistText]}>
          {finalist ? '🏆 Shot of the Week Finalist' : 'Shot of the Week 🏆'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Rendered in normal flow as the first child of the post's username/caption
  // block, so it always sits directly above the username however long the
  // caption is.
  wrap: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  banner: {
    backgroundColor: GOLD,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  text: {
    fontFamily: 'AbrilFatface_400Regular',
    color: NAVY,
    fontSize: 15,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  finalistBanner: {
    backgroundColor: FINALIST_GOLD,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  finalistText: {
    fontSize: 12,
  },
});
