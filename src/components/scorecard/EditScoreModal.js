import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import colors from '../../theme/colors';
import { computeTotals } from './ScorecardCard';
import { updateScorecardScore } from '../../services/scorecards';

function parseWholeNumber(text) {
  const trimmed = text.trim();
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return value > 0 ? value : null;
}

function showError(message) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Something went wrong', message);
}

// Owner-only "Edit Score": manually override a round's total strokes and
// the course par its +/- is measured against (e.g. when the course API had
// the wrong par). Both fields pre-fill with what the card currently shows;
// onSaved gets the updated scorecard so the caller can re-render with it.
export default function EditScoreModal({ visible, scorecard, onClose, onSaved }) {
  const [strokes, setStrokes] = useState('');
  const [par, setPar] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !scorecard) return;
    const { totalScore, totalPar } = computeTotals(scorecard);
    setStrokes(String(totalScore));
    setPar(String(totalPar));
  }, [visible, scorecard]);

  const strokesValue = parseWholeNumber(strokes);
  const parValue = parseWholeNumber(par);
  const canSave = strokesValue != null && parValue != null && !saving;

  async function handleSave() {
    if (!canSave || !scorecard?.id) return;
    setSaving(true);
    try {
      const updated = await updateScorecardScore(scorecard.id, { manualTotal: strokesValue, manualPar: parValue });
      onSaved(updated);
    } catch (err) {
      console.error('Failed to save score edit:', err);
      showError('Could not save your score. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Edit Score</Text>

          <Text style={styles.label}>Total Strokes</Text>
          <TextInput
            style={styles.input}
            value={strokes}
            onChangeText={setStrokes}
            keyboardType="number-pad"
            maxLength={3}
            selectTextOnFocus
          />

          <Text style={styles.label}>Course Par</Text>
          <TextInput
            style={styles.input}
            value={par}
            onChangeText={setPar}
            keyboardType="number-pad"
            maxLength={3}
            selectTextOnFocus
          />

          <View style={styles.buttonRow}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton} activeOpacity={0.8} disabled={saving}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveButton, !canSave && styles.disabled]}
              activeOpacity={0.8}
              disabled={!canSave}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.brightGreenText} />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 14,
    padding: 20,
  },
  title: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 16,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  input: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cancelButtonText: {
    color: colors.white,
    fontSize: 14,
  },
  saveButton: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.brightGreen,
  },
  saveButtonText: {
    color: colors.brightGreenText,
    fontSize: 14,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
