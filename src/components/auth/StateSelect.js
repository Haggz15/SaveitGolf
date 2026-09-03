import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { US_STATES } from '../../data/usStates';

export default function StateSelect({ value, onChange, placeholder = 'Select home state' }) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setVisible(true)} activeOpacity={0.8}>
        <Text style={value ? styles.value : styles.placeholder}>{value || placeholder}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        transparent
        supportedOrientations={['portrait']}
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Home State</Text>
              <TouchableOpacity onPress={() => setVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={US_STATES}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onChange(item);
                    setVisible(false);
                  }}
                >
                  <Text style={styles.rowText}>{item}</Text>
                  {item === value ? <Ionicons name="checkmark" size={18} color={colors.red} /> : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 14,
  },
  value: {
    color: colors.white,
    fontSize: 15,
  },
  placeholder: {
    color: colors.muted,
    fontSize: 15,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  sheetTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  rowText: {
    color: colors.offWhite,
    fontSize: 15,
  },
});
