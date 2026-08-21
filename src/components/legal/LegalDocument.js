import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { LEGAL_LAST_UPDATED } from '../../data/legalContent';

export default function LegalDocument({ navigation, title, sections }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lastUpdated}>Last updated: {LEGAL_LAST_UPDATED}</Text>
        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            <Text style={styles.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    color: colors.white,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  lastUpdated: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 20,
  },
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionBody: {
    color: colors.offWhite,
    fontSize: 13,
    lineHeight: 20,
  },
});
