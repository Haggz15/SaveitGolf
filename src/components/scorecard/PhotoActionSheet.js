import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// Bottom action sheet shown when the owner taps a scorecard's attached
// photo: Change Photo (re-open the picker) or Crop Photo (crop tool). A
// plain Modal rather than ActionSheetIOS/Alert so it looks the same on
// iOS, Android and web (react-native-web's Alert has no buttons).
export default function PhotoActionSheet({ visible, onChangePhoto, onCropPhoto, onClose }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <TouchableOpacity style={styles.option} onPress={onChangePhoto} activeOpacity={0.7}>
            <Ionicons name="images-outline" size={20} color={colors.white} />
            <Text style={styles.optionText}>Change Photo</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.option} onPress={onCropPhoto} activeOpacity={0.7}>
            <Ionicons name="crop-outline" size={20} color={colors.white} />
            <Text style={styles.optionText}>Crop Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.navyCard,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  optionText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.navyBorder,
  },
  cancel: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: colors.navyLight,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: '600',
  },
});
