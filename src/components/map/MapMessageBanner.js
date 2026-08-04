import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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

export function MapLoadingBanner({ children }) {
  return (
    <View style={styles.loadingBanner}>
      <ActivityIndicator size="small" color={colors.red} />
      <Text style={styles.loadingBannerText}>{children}</Text>
    </View>
  );
}

// Same pill as MapLoadingBanner but for a completed result (e.g. the
// "N courses in <State>" count shown once a state finishes loading).
export function MapSuccessBanner({ children }) {
  return (
    <View style={styles.loadingBanner}>
      <Ionicons name="checkmark-circle" size={16} color={colors.green} />
      <Text style={styles.loadingBannerText}>{children}</Text>
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
  loadingBanner: {
    position: 'absolute',
    top: 12,
    zIndex: 1000,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  loadingBannerText: {
    color: colors.muted,
    fontSize: 12,
  },
});
