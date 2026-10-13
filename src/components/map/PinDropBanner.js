import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Instructions + Cancel/Save for the map's "Drop pin on map" mode (see
// useCourseMapData's pinDrop). Save stays disabled until a pin is placed.
export default function PinDropBanner({ pinDrop, onCancel, onConfirm }) {
  const { courseName, candidate, saving } = pinDrop;
  return (
    <View style={styles.banner}>
      <Ionicons name="pin" size={16} color={colors.red} />
      <Text style={styles.text} numberOfLines={2}>
        {candidate
          ? `Pin placed for ${courseName} — tap elsewhere to move it`
          : `Tap the map where ${courseName} is`}
      </Text>
      <TouchableOpacity onPress={onCancel} disabled={saving} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onConfirm}
        disabled={!candidate || saving}
        style={[styles.saveButton, (!candidate || saving) && styles.saveButtonDisabled]}
      >
        {saving ? <ActivityIndicator size="small" color={colors.white} /> : <Text style={styles.saveText}>Save</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.red,
    gap: 8,
  },
  text: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  cancelButton: {
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  saveButton: {
    minWidth: 56,
    alignItems: 'center',
    backgroundColor: colors.red,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
});
