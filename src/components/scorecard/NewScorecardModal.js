import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchCourses, getCourseById } from '../../services/golfCourseApi';

// Typical 18-hole par distribution, used as a fallback whenever the selected
// course has no live tee/par data (or the user free-typed a course name).
const DEFAULT_HOLE_PATTERN = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5];

const SEARCH_DEBOUNCE_MS = 400;

function formatDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

async function resolveHolePars(course, holesCount) {
  if (course?.id) {
    try {
      const full = await getCourseById(course.id);
      const primaryTee = full.tees?.male?.[0] ?? full.tees?.female?.[0];
      const holes = primaryTee?.holes;
      if (holes && holes.length >= holesCount) {
        return holes.slice(0, holesCount).map((h) => h.par ?? 4);
      }
    } catch (err) {
      // Fall through to the default pattern below.
    }
  }
  return DEFAULT_HOLE_PATTERN.slice(0, holesCount);
}

function sumFilled(scores, holeNumbers) {
  return holeNumbers.reduce((sum, hole) => {
    const value = scores[hole];
    return value ? sum + Number(value) : sum;
  }, 0);
}

const INITIAL_STATE = {
  step: 'course',
  courseQuery: '',
  courseResults: [],
  searching: false,
  selectedCourse: null,
  holesCount: null,
  pars: null,
  loadingPars: false,
  scores: {},
};

export default function NewScorecardModal({ visible, onClose, onSaved, fullName }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(INITIAL_STATE);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (!visible) {
      setState(INITIAL_STATE);
      if (searchTimer.current) clearTimeout(searchTimer.current);
    }
  }, [visible]);

  function patch(updates) {
    setState((prev) => ({ ...prev, ...updates }));
  }

  function handleChangeQuery(text) {
    patch({ courseQuery: text, selectedCourse: null });
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length < 2) {
      patch({ courseResults: [], searching: false });
      return;
    }

    patch({ searching: true });
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCourses(text.trim());
        patch({ courseResults: results, searching: false });
      } catch (err) {
        patch({ courseResults: [], searching: false });
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectCourseResult(course) {
    patch({ selectedCourse: course, courseQuery: course.name, courseResults: [] });
  }

  function handleContinueFromCourse() {
    const course = state.selectedCourse ?? { id: null, name: state.courseQuery.trim() };
    if (!course.name) return;
    patch({ selectedCourse: course, step: 'holes' });
  }

  async function handleSelectHoles(holesCount) {
    patch({ holesCount, loadingPars: true, step: 'entry' });
    const pars = await resolveHolePars(state.selectedCourse, holesCount);
    patch({ pars, loadingPars: false });
  }

  function handleScoreChange(hole, text) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    setState((prev) => ({ ...prev, scores: { ...prev.scores, [hole]: digits } }));
  }

  function handleRequestClose() {
    const hasProgress = Object.values(state.scores).some((v) => v) || state.step !== 'course';
    if (hasProgress) {
      Alert.alert('Discard scorecard?', 'You have unsaved progress that will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
      return;
    }
    onClose();
  }

  async function handleSave() {
    const { selectedCourse, holesCount, pars, scores } = state;
    const holeNumbers = Array.from({ length: holesCount }, (_, i) => i + 1);

    const front = holeNumbers.slice(0, 9).map((hole, idx) => ({
      hole,
      par: pars[idx],
      score: Number(scores[hole]),
    }));
    const back =
      holesCount === 18
        ? holeNumbers.slice(9, 18).map((hole, idx) => ({
            hole,
            par: pars[9 + idx],
            score: Number(scores[hole]),
          }))
        : undefined;

    const newScorecard = {
      id: `sc_${Date.now()}`,
      courseName: selectedCourse.name,
      date: formatDate(new Date()),
      holesCount,
      front,
      ...(back ? { back } : {}),
      createdAt: new Date().toISOString(),
    };

    onSaved(newScorecard);
  }

  const holeNumbers = state.holesCount ? Array.from({ length: state.holesCount }, (_, i) => i + 1) : [];
  const frontNumbers = holeNumbers.slice(0, 9);
  const backNumbers = holeNumbers.slice(9, 18);
  const frontTotal = sumFilled(state.scores, frontNumbers);
  const backTotal = backNumbers.length ? sumFilled(state.scores, backNumbers) : null;
  const grandTotal = frontTotal + (backTotal ?? 0);
  const allFilled =
    holeNumbers.length > 0 &&
    holeNumbers.every((h) => state.scores[h] && Number(state.scores[h]) > 0);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleRequestClose}
    >
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Scorecard</Text>
          <TouchableOpacity onPress={handleRequestClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {state.step === 'course' && (
          <View style={styles.stepContent}>
            <Text style={styles.label}>COURSE</Text>
            <TextInput
              style={styles.input}
              value={state.courseQuery}
              onChangeText={handleChangeQuery}
              placeholder="Search or type course name"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoFocus
            />

            {state.courseQuery.trim().length >= 2 && (
              <View style={styles.dropdown}>
                {state.searching ? (
                  <View style={styles.statusRow}>
                    <ActivityIndicator size="small" color={colors.red} />
                    <Text style={styles.statusText}>Searching…</Text>
                  </View>
                ) : state.courseResults.length === 0 ? (
                  <View style={styles.statusRow}>
                    <Text style={styles.statusText}>No matches — you can still continue with this name</Text>
                  </View>
                ) : (
                  <FlatList
                    data={state.courseResults}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    style={styles.resultsList}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.resultRow} onPress={() => handleSelectCourseResult(item)}>
                        <Ionicons name="flag-outline" size={16} color={colors.red} />
                        <View style={styles.resultTextWrap}>
                          <Text style={styles.resultName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.resultLocation} numberOfLines={1}>
                            {[item.city, item.state].filter(Boolean).join(', ') || 'Location unknown'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryButton, state.courseQuery.trim().length === 0 && styles.primaryButtonDisabled]}
                onPress={handleContinueFromCourse}
                disabled={state.courseQuery.trim().length === 0}
              >
                <Text style={styles.primaryButtonText}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state.step === 'holes' && (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.backRow} onPress={() => patch({ step: 'course' })}>
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
              <Text style={styles.backText}>{state.selectedCourse?.name}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>HOLES PLAYED</Text>
            <View style={styles.holesRow}>
              <TouchableOpacity style={styles.holesButton} onPress={() => handleSelectHoles(9)} activeOpacity={0.85}>
                <Text style={styles.holesButtonNumber}>9</Text>
                <Text style={styles.holesButtonLabel}>HOLES</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.holesButton} onPress={() => handleSelectHoles(18)} activeOpacity={0.85}>
                <Text style={styles.holesButtonNumber}>18</Text>
                <Text style={styles.holesButtonLabel}>HOLES</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {state.step === 'entry' && (
          <View style={styles.stepContent}>
            <Text style={styles.entryCourseName} numberOfLines={1}>
              {state.selectedCourse?.name}
            </Text>
            <Text style={styles.entrySubtitle}>{state.holesCount} Holes</Text>

            {state.loadingPars ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={styles.statusText}>Loading course data…</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.entryScroll} keyboardShouldPersistTaps="handled">
                  {holeNumbers.map((hole) => (
                    <View key={hole} style={styles.holeRow}>
                      <Text style={styles.holeRowNumber}>Hole {hole}</Text>
                      <TextInput
                        style={styles.scoreInput}
                        value={state.scores[hole] ?? ''}
                        onChangeText={(text) => handleScoreChange(hole, text)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="-"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  ))}
                  <View style={{ height: 12 }} />
                </ScrollView>

                <View style={styles.totalsRow}>
                  <View style={styles.totalsCell}>
                    <Text style={styles.totalsValue}>{frontTotal || '–'}</Text>
                    <Text style={styles.totalsLabel}>FRONT</Text>
                  </View>
                  {backNumbers.length > 0 && (
                    <View style={styles.totalsCell}>
                      <Text style={styles.totalsValue}>{backTotal || '–'}</Text>
                      <Text style={styles.totalsLabel}>BACK</Text>
                    </View>
                  )}
                  <View style={styles.totalsCell}>
                    <Text style={styles.totalsValueLarge}>{grandTotal || '–'}</Text>
                    <Text style={styles.totalsLabel}>TOTAL</Text>
                  </View>
                </View>

                <View style={styles.footer}>
                  <TouchableOpacity
                    style={[styles.primaryButton, !allFilled && styles.primaryButtonDisabled]}
                    onPress={handleSave}
                    disabled={!allFilled}
                  >
                    <Text style={styles.primaryButtonText}>Save Scorecard</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        )}
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
  stepContent: {
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
  dropdown: {
    marginTop: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 280,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    gap: 10,
  },
  resultTextWrap: {
    flex: 1,
  },
  resultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resultLocation: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  primaryButton: {
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.4,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  backText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
  holesRow: {
    flexDirection: 'row',
    gap: 14,
  },
  holesButton: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  holesButtonNumber: {
    color: colors.white,
    fontSize: 42,
    fontWeight: '900',
  },
  holesButtonLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 4,
  },
  entryCourseName: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  entrySubtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 14,
  },
  entryScroll: {
    flex: 1,
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  holeRowNumber: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  scoreInput: {
    width: 60,
    height: 44,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
  },
  totalsCell: {
    alignItems: 'center',
  },
  totalsValue: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
  },
  totalsValueLarge: {
    color: colors.red,
    fontSize: 24,
    fontWeight: '900',
  },
  totalsLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
});
