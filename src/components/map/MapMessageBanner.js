import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

export function MapWarningBanner({ icon, children }) {
  return (
    <View style={styles.warningBanner}>
      <Ionicons name={icon} size={14} color={colors.gold} />
      <Text style={styles.warningText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  warningText: {
    color: colors.muted,
    fontSize: 11,
    flex: 1,
  },
});
