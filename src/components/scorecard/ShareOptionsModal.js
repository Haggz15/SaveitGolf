import { useRef } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Bottom sheet for a just-captured scorecard image (see ScorecardScreen's
// handleShare): save straight to the camera roll, or hand the image to the
// native iOS share sheet, which already covers AirDrop, Messages,
// Instagram, TikTok etc. without any app-specific deep links.
// Native iOS only; ScorecardScreen never opens this on web.
export default function ShareOptionsModal({ visible, onClose, onSaveToPhotos, onShare }) {
  // iOS silently refuses to present the native share sheet while this modal
  // is still animating away, so Share closes the sheet first and only fires
  // onShare once it's fully dismissed (onDismiss), with a timer fallback in
  // case onDismiss never arrives.
  const pendingShare = useRef(false);

  function runPendingShare() {
    if (!pendingShare.current) return;
    pendingShare.current = false;
    onShare();
  }

  function handleSharePress() {
    pendingShare.current = true;
    onClose();
    setTimeout(runPendingShare, 800);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
      onDismiss={runPendingShare}
    >
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Share Scorecard</Text>

          <TouchableOpacity onPress={onSaveToPhotos} style={styles.option} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={20} color={colors.white} />
            <Text style={styles.optionTitle}>Save to Camera Roll</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSharePress} style={[styles.option, styles.lastOption]} activeOpacity={0.85}>
            <Ionicons name="share-outline" size={20} color={colors.white} />
            <Text style={styles.optionTitle}>Share</Text>
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
    justifyContent: 'center',
    gap: 10,
    padding: 16,
    backgroundColor: '#1a2e4a',
    borderRadius: 12,
    marginBottom: 10,
  },
  lastOption: {
    marginBottom: 20,
  },
  optionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
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
