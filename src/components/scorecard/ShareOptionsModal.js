import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Bottom sheet of native share destinations for a just-captured scorecard
// image (see ScorecardScreen's handleShare) — TikTok and Instagram get
// their own rows since they need app-specific handling (deep link, or a
// save-then-open fallback) beyond what the plain iOS share sheet can do.
// Native iOS only; ScorecardScreen never opens this on web.
export default function ShareOptionsModal({
  visible,
  onClose,
  onShareTikTok,
  onShareInstagram,
  onSaveToPhotos,
  onShareMore,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Share Scorecard</Text>

          <TouchableOpacity
            onPress={onShareTikTok}
            style={[styles.option, styles.tiktokOption]}
            activeOpacity={0.85}
          >
            <Text style={styles.optionIcon}>🎵</Text>
            <View>
              <Text style={styles.optionTitle}>Share to TikTok</Text>
              <Text style={styles.optionSubtitle}>Saves to camera roll then opens TikTok</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onShareInstagram}
            style={[styles.option, styles.instagramOption]}
            activeOpacity={0.85}
          >
            <Text style={styles.optionIcon}>📸</Text>
            <View>
              <Text style={styles.optionTitle}>Share to Instagram</Text>
              <Text style={styles.optionSubtitle}>Opens Instagram Stories with scorecard</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onSaveToPhotos} style={styles.option} activeOpacity={0.85}>
            <Text style={styles.optionIcon}>📥</Text>
            <View>
              <Text style={styles.optionTitle}>Save to Camera Roll</Text>
              <Text style={styles.optionSubtitle}>Save scorecard image to Photos</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onShareMore} style={[styles.option, styles.lastOption]} activeOpacity={0.85}>
            <Text style={styles.optionIcon}>⬆️</Text>
            <View>
              <Text style={styles.optionTitle}>More Options</Text>
              <Text style={styles.optionSubtitle}>Messages, Mail, AirDrop and more</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  title: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    backgroundColor: '#1a2e4a',
    borderRadius: 12,
    marginBottom: 10,
  },
  // TikTok/Instagram brand colors — deliberately not the app's own palette
  // so each row reads as "this is that app" at a glance.
  tiktokOption: {
    backgroundColor: '#010101',
  },
  instagramOption: {
    backgroundColor: '#833ab4',
  },
  lastOption: {
    marginBottom: 20,
  },
  optionIcon: {
    fontSize: 24,
  },
  optionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
  },
  cancelButton: {
    padding: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#6a8ab0',
    fontSize: 15,
  },
});
