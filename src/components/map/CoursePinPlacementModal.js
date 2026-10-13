import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { PinPlacementMap } from './CoursePinMaps';

const PIN_ICON_SIZE = 44;

// "Pin placement mode" for a hand-typed course (see CourseDetailScreen): a
// full-screen map with a pin fixed at the center of the screen. The user
// pans the map underneath it, and "Save location" hands back whatever
// coordinate the pin is sitting on.
export default function CoursePinPlacementModal({ visible, courseName, initialCenter, zoomedIn, saving, onCancel, onSave }) {
  const insets = useSafeAreaInsets();
  const [center, setCenter] = useState(initialCenter);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={saving ? undefined : onCancel}
      onShow={() => setCenter(initialCenter)}
    >
      <View style={styles.screen}>
        {visible && (
          <PinPlacementMap initialCenter={initialCenter} zoomedIn={zoomedIn} onCenterChange={setCenter} />
        )}

        {/* The pin's tip — not its middle — marks the saved coordinate, so
            lift the icon by half its height. */}
        <View style={styles.pinOverlay} pointerEvents="none">
          <Ionicons name="location" size={PIN_ICON_SIZE} color={colors.red} style={styles.pinIcon} />
        </View>

        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onCancel} disabled={saving} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.instructions} numberOfLines={2}>
            Move the map so the pin sits on {courseName ?? 'the course'}
          </Text>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={() => onSave(center)}
            disabled={saving || !center}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.saveText}>Save location</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  pinOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinIcon: {
    transform: [{ translateY: -PIN_ICON_SIZE / 2 }],
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(13, 31, 60, 0.92)',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  cancelText: {
    color: colors.red,
    fontSize: 16,
    fontWeight: '600',
  },
  instructions: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
