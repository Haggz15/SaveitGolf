import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import colors from '../../theme/colors';

// Web-only fallback for the native crop step (expo-image-picker's
// allowsEditing has no web implementation — ScorecardScreen/
// ScorecardDetailModal pick a photo there via a raw <input type="file">,
// which shows no OS crop UI at all). This isn't a true pixel crop: the
// card's photo always renders `cover`-resized to its frame regardless of
// layout, so all this needs to do is let the user drag to choose *which*
// part of the photo lands under that frame before it's applied, then hand
// that position back so ScorecardCard can render it at the same spot via
// CSS objectPosition.
export default function WebPhotoCropModal({ visible, uri, position, onPositionChange, onCancel, onConfirm }) {
  if (!uri) return null;

  function handleDrag(clientX, clientY, rect) {
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    onPositionChange({ x, y });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Text style={styles.title}>Position Photo</Text>
        <Text style={styles.subtitle}>Drag to choose which part shows</Text>

        {/* Raw DOM drag surface — this component only ever mounts on web
            (see ScorecardScreen/ScorecardDetailModal), so reaching past RN's
            View/touch primitives straight to mouse events here matches the
            rest of this app's web-only file-picker code. */}
        <div
          style={{
            width: 260,
            height: 360,
            overflow: 'hidden',
            borderRadius: 12,
            border: `2px solid ${colors.brightGreen}`,
            cursor: 'grab',
            position: 'relative',
          }}
          onMouseMove={(e) => {
            if (e.buttons !== 1) return;
            handleDrag(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
          }}
          onTouchMove={(e) => {
            const touch = e.touches[0];
            if (!touch) return;
            handleDrag(touch.clientX, touch.clientY, e.currentTarget.getBoundingClientRect());
          }}
        >
          <img
            src={uri}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `${position.x}% ${position.y}%`,
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          />
        </div>

        <View style={styles.buttonRow}>
          <TouchableOpacity onPress={onCancel} style={styles.cancelButton} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onConfirm} style={styles.confirmButton} activeOpacity={0.8}>
            <Text style={styles.confirmButtonText}>Use Photo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 15,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    padding: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  confirmButton: {
    padding: 12,
    paddingHorizontal: 28,
    borderRadius: 8,
    backgroundColor: colors.brightGreen,
  },
  confirmButtonText: {
    color: colors.brightGreenText,
    fontSize: 14,
    fontWeight: '700',
  },
});
