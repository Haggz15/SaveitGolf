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
  wrap: {
    position: 'absolute',
    left: 0,
    right: 60,
    bottom: 86,
    alignItems: 'center',
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
    fontFamily: 'Cinzel_700Bold',
    color: NAVY,
    fontSize: 13,
    letterSpacing: 0.3,
  },
});
