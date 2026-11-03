import { Linking, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';

// One-time "Update Available" message (see useOneTimeUpdatePrompt). It's
// optional: "Not Now" or the Android back button dismisses it, and either
// button closes it for good for this App Store version.
export default function UpdatePromptModal({ storeUrl, onDismiss }) {
  const openStore = () => {
    onDismiss();
    Linking.openURL(storeUrl).catch((err) => console.log('Open App Store error:', err));
  };

  return (
    <Modal visible={!!storeUrl} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Update Available 🏌️</Text>
          <Text style={styles.message}>
            A new update for SaveitGolf is available! Head to the App Store to get the latest version.
          </Text>
          <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={onDismiss} activeOpacity={0.7}>
            <Text style={styles.dismissText}>Not Now</Text>
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
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 23,
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.9,
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
  dismissButton: {
    alignSelf: 'stretch',
    marginTop: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.white,
    opacity: 0.7,
    fontSize: 15,
    fontWeight: '600',
  },
});
