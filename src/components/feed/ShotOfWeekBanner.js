import { View, Text, StyleSheet } from 'react-native';

const GOLD = '#F5E6C8';
const NAVY = '#0d1f3c';

export default function ShotOfWeekBanner() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.banner}>
        <Text style={styles.text}>Shot of the Week 🏆</Text>
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
});
