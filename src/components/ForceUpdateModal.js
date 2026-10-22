import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';

// Blocks the whole app until the user updates: no close button, no backdrop
// tap, and the Android back button is swallowed by the no-op onRequestClose.
export default function ForceUpdateModal({ storeUrl }) {
  const openStore = () => {
    Linking.openURL(storeUrl).catch((err) => console.log('Open App Store error:', err));
  };

  return (
    <Modal visible={!!storeUrl} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.message}>
            A new update is available. Please update SaveitGolf to continue.
          </Text>
          <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.navyCard,
    borderColor: colors.navyBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  message: {
    color: colors.white,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    alignSelf: 'stretch',
    backgroundColor: colors.red,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
