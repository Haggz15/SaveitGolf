import { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

function clampRating(value) {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

export default function CourseRankingModal({ visible, initialRanking, onClose, onSave }) {
  const insets = useSafeAreaInsets();
  const [courseName, setCourseName] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setCourseName(initialRanking?.courseName ?? '');
      setRating(initialRanking?.rating ?? 5);
    }
  }, [visible, initialRanking]);

  function handleStep(delta) {
    setRating((prev) => clampRating(prev + delta));
  }

  function handleRatingText(text) {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const num = Number(cleaned);
    if (cleaned === '' || Number.isNaN(num)) {
      setRating(0);
      return;
    }
    setRating(Math.min(10, num));
  }

  async function handleSave() {
    if (!courseName.trim()) {
      Alert.alert('Add a course name', 'Enter the name of the course you played.');
      return;
    }
    setSaving(true);
    try {
      await onSave({ courseName: courseName.trim(), rating: clampRating(rating) });
    } catch (err) {
      console.error('Failed to save course ranking:', err);
      Alert.alert('Something went wrong', 'Could not save this ranking. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{initialRanking ? 'Update Ranking' : 'Add Course Ranking'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Course Name</Text>
          <TextInput
            style={styles.input}
            value={courseName}
            onChangeText={setCourseName}
            placeholder="e.g. Pebble Beach Golf Links"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />

          <Text style={styles.label}>Rating</Text>
          <View style={styles.ratingRow}>
            <TouchableOpacity style={styles.stepButton} onPress={() => handleStep(-0.1)}>
              <Ionicons name="remove" size={20} color={colors.white} />
            </TouchableOpacity>
            <TextInput
              style={styles.ratingInput}
              value={rating.toFixed(1)}
              onChangeText={handleRatingText}
              keyboardType="decimal-pad"
            />
            <TouchableOpacity style={styles.stepButton} onPress={() => handleStep(0.1)}>
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>
          <Text style={styles.helperText}>0.0 – 10.0, in steps of 0.1</Text>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Save Ranking'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.white,
    fontSize: 15,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingInput: {
    flex: 1,
    textAlign: 'center',
    color: colors.gold,
    fontSize: 28,
    fontWeight: '800',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    paddingVertical: 8,
  },
  helperText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
