import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import AuthTextField from '../auth/AuthTextField';
import { estimateHandicapFromAverageScore } from '../../utils/handicap';

const MODES = {
  KNOW: 'know',
  AVERAGE: 'average',
};

export default function HandicapInputModal({ visible, onClose, onSubmit }) {
  const [mode, setMode] = useState(MODES.KNOW);
  const [handicapText, setHandicapText] = useState('');
  const [averageScoreText, setAverageScoreText] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const resetAndClose = () => {
    setMode(MODES.KNOW);
    setHandicapText('');
    setAverageScoreText('');
    setError('');
    setSaving(false);
    onClose();
  };

  const parsedAverageScore = Number(averageScoreText.trim());
  const estimatedHandicap =
    mode === MODES.AVERAGE && averageScoreText.trim() && !Number.isNaN(parsedAverageScore)
      ? estimateHandicapFromAverageScore(parsedAverageScore)
      : null;

  const handleSave = async () => {
    let value;
    if (mode === MODES.KNOW) {
      const parsed = Number(handicapText.trim());
      if (handicapText.trim() === '' || Number.isNaN(parsed)) {
        setError('Enter a valid handicap index.');
        return;
      }
      value = parsed;
    } else {
      if (averageScoreText.trim() === '' || Number.isNaN(parsedAverageScore)) {
        setError('Enter a valid average score.');
        return;
      }
      value = estimateHandicapFromAverageScore(parsedAverageScore);
    }

    setError('');
    setSaving(true);
    try {
      await onSubmit(value);
      resetAndClose();
    } catch (err) {
      setError(err.message || 'Failed to save handicap.');
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      supportedOrientations={['portrait']}
      onRequestClose={resetAndClose}
    >
      <SafeAreaView style={styles.modalRoot}>
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Set Your Handicap</Text>
            <TouchableOpacity onPress={resetAndClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeButton, mode === MODES.KNOW && styles.modeButtonActive]}
                onPress={() => setMode(MODES.KNOW)}
              >
                <Text style={[styles.modeButtonText, mode === MODES.KNOW && styles.modeButtonTextActive]}>
                  I know my handicap
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeButton, mode === MODES.AVERAGE && styles.modeButtonActive]}
                onPress={() => setMode(MODES.AVERAGE)}
              >
                <Text style={[styles.modeButtonText, mode === MODES.AVERAGE && styles.modeButtonTextActive]}>
                  Use my average score
                </Text>
              </TouchableOpacity>
            </View>

            {mode === MODES.KNOW ? (
              <AuthTextField
                placeholder="Handicap index (e.g. 12.4)"
                value={handicapText}
                onChangeText={setHandicapText}
                keyboardType="decimal-pad"
              />
            ) : (
              <>
                <AuthTextField
                  placeholder="Average 18-hole score (e.g. 90)"
                  value={averageScoreText}
                  onChangeText={setAverageScoreText}
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>
                  We will estimate your handicap based on your average score.
                </Text>
                {estimatedHandicap != null && (
                  <Text style={styles.estimateText}>Estimated handicap index: {estimatedHandicap}</Text>
                )}
              </>
            )}

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveButtonText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
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
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navyCard,
    alignItems: 'center',
  },
  modeButtonActive: {
    borderColor: colors.red,
    backgroundColor: colors.navyLight,
  },
  modeButtonText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  modeButtonTextActive: {
    color: colors.white,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 10,
  },
  estimateText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  errorText: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 10,
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
});
