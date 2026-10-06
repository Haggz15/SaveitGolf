import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import AuthTextField from '../auth/AuthTextField';
import { estimateHandicapFromAverageScore, parseHandicapInput, formatHandicap } from '../../utils/handicap';

const MODES = {
  KNOW: 'know',
  AVERAGE: 'average',
};

// Rendered in-modal so the system keyboard never opens. The "+" key marks a
// plus handicap (stored negative, see parseHandicapInput).
const PAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['+', '0', '.'],
];

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
      const parsed = parseHandicapInput(handicapText);
      if (parsed === null) {
        setError('Enter a valid handicap index (e.g. 12.4).');
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

  const handlePadKey = (key) => {
    setError('');
    setHandicapText((prev) => {
      if (key === '+') return prev.startsWith('+') ? prev : `+${prev}`;
      if (key === '.' && prev.includes('.')) return prev;
      return prev + key;
    });
  };

  const handleBackspace = () => {
    setError('');
    setHandicapText((prev) => prev.slice(0, -1));
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
              <>
                <View style={styles.padDisplay}>
                  <Text
                    style={[styles.padDisplayText, !handicapText && styles.padDisplayPlaceholder]}
                    numberOfLines={1}
                  >
                    {handicapText || 'e.g. 12.4'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleBackspace}
                    disabled={!handicapText}
                    hitSlop={10}
                    accessibilityLabel="Delete last character"
                  >
                    <Ionicons
                      name="backspace-outline"
                      size={24}
                      color={handicapText ? colors.white : colors.muted}
                    />
                  </TouchableOpacity>
                </View>
                <View style={styles.pad}>
                  {PAD_KEYS.map((row) => (
                    <View key={row.join('')} style={styles.padRow}>
                      {row.map((key) => (
                        <TouchableOpacity
                          key={key}
                          style={styles.padKey}
                          onPress={() => handlePadKey(key)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.padKeyText}>{key}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))}
                </View>
              </>
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
                  <Text style={styles.estimateText}>Estimated handicap index: {formatHandicap(estimatedHandicap)}</Text>
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
  padDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navyCard,
    marginBottom: 12,
  },
  padDisplayText: {
    flex: 1,
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  padDisplayPlaceholder: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '500',
  },
  pad: {
    gap: 8,
    marginBottom: 14,
  },
  padRow: {
    flexDirection: 'row',
    gap: 8,
  },
  padKey: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  padKeyText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '600',
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
