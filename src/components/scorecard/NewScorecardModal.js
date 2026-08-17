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
  Keyboard,
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
const AUTO_ADVANCE_DELAY_MS = 500;

// For a 9-hole round played on the back nine, pull pars for holes 10-18
// instead of 1-9 — both from live tee data and the default fallback
// pattern (which happens to sum to par 36 either half).
async function resolveHolePars(course, holesCount, nineSide) {
  const offset = holesCount === 9 && nineSide === 'back' ? 9 : 0;
  if (course?.id) {
    try {
      const full = await getCourseById(course.id);
      const primaryTee = full.tees?.male?.[0] ?? full.tees?.female?.[0];
      const holes = primaryTee?.holes;
      if (holes && holes.length >= offset + holesCount) {
        return holes.slice(offset, offset + holesCount).map((h) => h.par ?? 4);
      }
    } catch (err) {
      // Fall through to the default pattern below.
    }
  }
  return DEFAULT_HOLE_PATTERN.slice(offset, offset + holesCount);
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
  nineSide: 'front',
  pars: null,
  loadingPars: false,
  scores: {},
  compositeToggleOpen: false,
  compositeFront: '',
  compositeBack: '',
};

export default function NewScorecardModal({ visible, onClose, onSaved, fullName }) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(INITIAL_STATE);
  const searchTimer = useRef(null);
  // Per-hole auto-advance timers, score input refs, and measured row
  // offsets (from onLayout, relative to the entry ScrollView's content) —
  // together these drive "confirm a score -> focus + center the next hole".
  const advanceTimers = useRef({});
  const scoreInputRefs = useRef({});
  const rowLayouts = useRef({});
  const entryScrollRef = useRef(null);
  const entryViewportHeight = useRef(0);

  useEffect(() => {
    if (!visible) {
      setState(INITIAL_STATE);
      if (searchTimer.current) clearTimeout(searchTimer.current);
      Object.values(advanceTimers.current).forEach(clearTimeout);
      advanceTimers.current = {};
      scoreInputRefs.current = {};
      rowLayouts.current = {};
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
    const pars = await resolveHolePars(state.selectedCourse, holesCount, state.nineSide);
    patch({ pars, loadingPars: false });
  }

  function handleScoreChange(hole, text) {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    setState((prev) => ({ ...prev, scores: { ...prev.scores, [hole]: digits } }));

    if (advanceTimers.current[hole]) {
      clearTimeout(advanceTimers.current[hole]);
      delete advanceTimers.current[hole];
    }
    // A confirmed score auto-advances shortly after the user stops typing;
    // each keystroke resets this timer so a two-digit score (e.g. "12")
    // doesn't jump ahead after just the first digit.
    if (digits) {
      advanceTimers.current[hole] = setTimeout(() => {
        delete advanceTimers.current[hole];
        advanceFromHole(hole);
      }, AUTO_ADVANCE_DELAY_MS);
    }
  }

  function scrollToHole(hole) {
    const layout = rowLayouts.current[hole];
    if (!layout || !entryScrollRef.current) return;
    const target = Math.max(0, layout.y - entryViewportHeight.current / 2 + layout.height / 2);
    entryScrollRef.current.scrollTo({ y: target, animated: true });
  }

  function focusHole(hole) {
    scoreInputRefs.current[hole]?.focus();
    scrollToHole(hole);
  }

  function advanceFromHole(hole) {
    if (advanceTimers.current[hole]) {
      clearTimeout(advanceTimers.current[hole]);
      delete advanceTimers.current[hole];
    }
    const holeNumbers = state.holesCount ? Array.from({ length: state.holesCount }, (_, i) => i + 1) : [];
    const next = holeNumbers[holeNumbers.indexOf(hole) + 1];
    if (next) {
      focusHole(next);
    } else {
      Keyboard.dismiss();
    }
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
    const { selectedCourse, holesCount, nineSide, pars, scores, compositeFront, compositeBack } = state;
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
      course: selectedCourse,
      holesCount,
      front,
      ...(back ? { back } : {}),
      compositeFront: compositeFront.trim() || null,
      compositeBack: holesCount === 18 ? compositeBack.trim() || null : null,
      nineSide: holesCount === 9 ? nineSide : 'front',
    };

    onSaved(newScorecard);
  }

  const holeNumbers = state.holesCount ? Array.from({ length: state.holesCount }, (_, i) => i + 1) : [];
  const frontNumbers = holeNumbers.slice(0, 9);
  const backNumbers = holeNumbers.slice(9, 18);
  const frontTotal = sumFilled(state.scores, frontNumbers);
  const backTotal = backNumbers.length ? sumFilled(state.scores, backNumbers) : null;
  const grandTotal = frontTotal + (backTotal ?? 0);
  // `hole` stays a local 1-9 index everywhere (scores/pars keys, saved
  // `holes` rows) — this only offsets what's *displayed* for a back-nine
  // round, so hole 1 reads as "Hole 10".
  const isBackNine = state.holesCount === 9 && state.nineSide === 'back';
  const holeLabelStart = isBackNine ? 10 : 1;
  const soloNineLabel = isBackNine ? 'BACK' : 'FRONT';
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
            <TouchableOpacity
              style={styles.backRow}
              onPress={() => patch({ step: 'course', holesCount: null, compositeToggleOpen: false })}
            >
              <Ionicons name="chevron-back" size={18} color={colors.muted} />
              <Text style={styles.backText}>{state.selectedCourse?.name}</Text>
            </TouchableOpacity>

            <Text style={styles.label}>HOLES PLAYED</Text>
            <View style={styles.holesRow}>
              <TouchableOpacity
                style={[styles.holesButton, state.holesCount === 9 && styles.holesButtonSelected]}
                onPress={() => patch({ holesCount: 9 })}
                activeOpacity={0.85}
              >
                <Text style={styles.holesButtonNumber}>9</Text>
                <Text style={styles.holesButtonLabel}>HOLES</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.holesButton, state.holesCount === 18 && styles.holesButtonSelected]}
                onPress={() => patch({ holesCount: 18 })}
                activeOpacity={0.85}
              >
                <Text style={styles.holesButtonNumber}>18</Text>
                <Text style={styles.holesButtonLabel}>HOLES</Text>
              </TouchableOpacity>
            </View>

            {state.holesCount === 9 && (
              <>
                <Text style={[styles.label, styles.nineSideLabel]}>WHICH NINE?</Text>
                <View style={styles.nineSideRow}>
                  <TouchableOpacity
                    style={[styles.nineSideButton, state.nineSide === 'front' && styles.nineSideButtonSelected]}
                    onPress={() => patch({ nineSide: 'front' })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nineSideButtonTitle}>Front</Text>
                    <Text style={styles.nineSideButtonSubtitle}>Holes 1 - 9</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.nineSideButton, state.nineSide === 'back' && styles.nineSideButtonSelected]}
                    onPress={() => patch({ nineSide: 'back' })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.nineSideButtonTitle}>Back</Text>
                    <Text style={styles.nineSideButtonSubtitle}>Holes 10 - 18</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {state.holesCount != null && (
              <>
                <TouchableOpacity
                  style={styles.compositeToggleRow}
                  onPress={() => patch({ compositeToggleOpen: !state.compositeToggleOpen })}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={state.compositeToggleOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.muted}
                  />
                  <Text style={styles.compositeToggleText}>Course has multiple nines with a custom name</Text>
                </TouchableOpacity>

                {state.compositeToggleOpen && (
                  <View style={styles.compositeInputs}>
                    {state.holesCount === 9 ? (
                      <>
                        <Text style={styles.label}>WHAT NINE DID YOU PLAY? (OPTIONAL)</Text>
                        <TextInput
                          style={styles.input}
                          value={state.compositeFront}
                          onChangeText={(text) => patch({ compositeFront: text })}
                          placeholder="e.g. Blue, Ridge, Trail"
                          placeholderTextColor={colors.muted}
                          autoCorrect={false}
                        />
                      </>
                    ) : (
                      <>
                        <Text style={styles.label}>FRONT NINE NAME (OPTIONAL)</Text>
                        <TextInput
                          style={styles.input}
                          value={state.compositeFront}
                          onChangeText={(text) => patch({ compositeFront: text })}
                          placeholder="e.g. Blue, Ridge, Trail"
                          placeholderTextColor={colors.muted}
                          autoCorrect={false}
                        />
                        <Text style={[styles.label, styles.compositeSecondLabel]}>BACK NINE NAME (OPTIONAL)</Text>
                        <TextInput
                          style={styles.input}
                          value={state.compositeBack}
                          onChangeText={(text) => patch({ compositeBack: text })}
                          placeholder="e.g. Blue, Ridge, Trail"
                          placeholderTextColor={colors.muted}
                          autoCorrect={false}
                        />
                      </>
                    )}
                  </View>
                )}

                <View style={styles.footer}>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => handleSelectHoles(state.holesCount)}>
                    <Text style={styles.primaryButtonText}>Continue</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
                <View style={styles.progressRow}>
                  <Text style={styles.progressText}>
                    {holeNumbers.filter((h) => state.scores[h]).length} of {holeNumbers.length} holes
                  </Text>
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${
                            (holeNumbers.filter((h) => state.scores[h]).length / holeNumbers.length) * 100
                          }%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                <ScrollView
                  ref={entryScrollRef}
                  style={styles.entryScroll}
                  keyboardShouldPersistTaps="handled"
                  onLayout={(e) => {
                    entryViewportHeight.current = e.nativeEvent.layout.height;
                  }}
                >
                  {holeNumbers.map((hole) => {
                    const isLast = hole === holeNumbers[holeNumbers.length - 1];
                    return (
                      <View
                        key={hole}
                        style={styles.holeRow}
                        onLayout={(e) => {
                          rowLayouts.current[hole] = {
                            y: e.nativeEvent.layout.y,
                            height: e.nativeEvent.layout.height,
                          };
                        }}
                      >
                        <Text style={styles.holeRowNumber}>Hole {holeLabelStart + hole - 1}</Text>
                        <View style={styles.holeRowControls}>
                          <TextInput
                            ref={(node) => {
                              scoreInputRefs.current[hole] = node;
                            }}
                            style={styles.scoreInput}
                            value={state.scores[hole] ?? ''}
                            onChangeText={(text) => handleScoreChange(hole, text)}
                            keyboardType="number-pad"
                            maxLength={2}
                            placeholder="-"
                            placeholderTextColor={colors.muted}
                            returnKeyType={isLast ? 'done' : 'next'}
                            onSubmitEditing={() => advanceFromHole(hole)}
                          />
                          <TouchableOpacity
                            style={styles.nextButton}
                            onPress={() => advanceFromHole(hole)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name={isLast ? 'checkmark-circle' : 'arrow-forward-circle'}
                              size={26}
                              color={isLast ? colors.green : colors.red}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                  <View style={{ height: 12 }} />
                </ScrollView>

                <View style={styles.totalsRow}>
                  <View style={styles.totalsCell}>
                    <Text style={styles.totalsValue}>{frontTotal || '–'}</Text>
                    <Text style={styles.totalsLabel}>{backNumbers.length > 0 ? 'FRONT' : soloNineLabel}</Text>
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
  holesButtonSelected: {
    borderColor: colors.red,
    backgroundColor: colors.navyLight,
  },
  nineSideLabel: {
    marginTop: 20,
  },
  nineSideRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nineSideButton: {
    flex: 1,
    padding: 16,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  nineSideButtonSelected: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  nineSideButtonTitle: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
  nineSideButtonSubtitle: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 3,
  },
  compositeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  compositeToggleText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  compositeInputs: {
    marginTop: 14,
  },
  compositeSecondLabel: {
    marginTop: 14,
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
  progressRow: {
    marginBottom: 14,
  },
  progressText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.red,
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
  holeRowControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  nextButton: {
    alignItems: 'center',
    justifyContent: 'center',
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
