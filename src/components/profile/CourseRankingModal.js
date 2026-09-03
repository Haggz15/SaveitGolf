import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchCourses } from '../../services/golfCourseApi';

const SEARCH_DEBOUNCE_MS = 400;

function clampRating(value) {
  return Math.min(10, Math.max(0, Math.round(value * 10) / 10));
}

export default function CourseRankingModal({ visible, initialRanking, onClose, onSave }) {
  const insets = useSafeAreaInsets();
  const [courseName, setCourseName] = useState('');
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [courseResults, setCourseResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [ratingText, setRatingText] = useState('5.0');
  const [ratingError, setRatingError] = useState(null);
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      setCourseName(initialRanking?.courseName ?? '');
      setSelectedCourse(null);
      setCourseResults([]);
      setRatingText((initialRanking?.rating ?? 5).toFixed(1));
      setRatingError(null);
    } else if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
  }, [visible, initialRanking]);

  function handleChangeCourseName(text) {
    setCourseName(text);
    setSelectedCourse(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length < 2) {
      setCourseResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchCourses(text.trim());
        setCourseResults(results);
      } catch (err) {
        setCourseResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  function handleSelectCourseResult(course) {
    setSelectedCourse(course);
    setCourseName(course.name);
    setCourseResults([]);
  }

  function handleRatingChangeText(text) {
    // Digits and a single decimal point only — free typing, no clamping
    // mid-keystroke so "7.5" can be typed one character at a time.
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [whole, ...rest] = cleaned.split('.');
    const normalized = rest.length ? `${whole}.${rest.join('')}` : whole;
    setRatingText(normalized);
    setRatingError(null);
  }

  function handleRatingBlur() {
    const num = Number(ratingText);
    if (ratingText.trim() !== '' && !Number.isNaN(num)) {
      setRatingText(num.toFixed(1));
    }
  }

  async function handleSave() {
    if (!courseName.trim()) {
      Alert.alert('Add a course name', 'Search for and select the course you played.');
      return;
    }

    const num = Number(ratingText);
    if (ratingText.trim() === '' || Number.isNaN(num) || num < 0 || num > 10) {
      setRatingError('Rating must be between 0.0 and 10.0');
      return;
    }
    const rating = clampRating(num);

    setSaving(true);
    try {
      await onSave({
        courseId: selectedCourse?.id ?? null,
        courseName: courseName.trim(),
        rating,
      });
      setRatingText(rating.toFixed(1));
    } catch (err) {
      console.error('Failed to save course ranking:', err);
      Alert.alert('Something went wrong', 'Could not save this ranking. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{initialRanking ? 'Update Ranking' : 'Add Courses'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Course Name</Text>
          <TextInput
            style={styles.input}
            value={courseName}
            onChangeText={handleChangeCourseName}
            placeholder="Search for a course"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
          />

          {courseName.trim().length >= 2 && !selectedCourse && (
            <View style={styles.dropdown}>
              {searching ? (
                <View style={styles.statusRow}>
                  <ActivityIndicator size="small" color={colors.red} />
                  <Text style={styles.statusText}>Searching…</Text>
                </View>
              ) : courseResults.length === 0 ? (
                <View style={styles.statusRow}>
                  <Text style={styles.statusText}>No matches — you can still save with this name</Text>
                </View>
              ) : (
                <FlatList
                  data={courseResults}
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

          <Text style={styles.label}>Rating</Text>
          <TextInput
            style={[styles.ratingInput, ratingError && styles.ratingInputError]}
            value={ratingText}
            onChangeText={handleRatingChangeText}
            onBlur={handleRatingBlur}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={colors.muted}
          />
          {ratingError ? (
            <Text style={styles.errorText}>{ratingError}</Text>
          ) : (
            <Text style={styles.helperText}>0.0 – 10.0</Text>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving…' : initialRanking ? 'Update' : 'Save Ranking'}
            </Text>
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
  dropdown: {
    marginTop: -10,
    marginBottom: 16,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 220,
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
    paddingVertical: 14,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
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
  ratingInput: {
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
  ratingInputError: {
    borderColor: colors.red,
  },
  helperText: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 8,
  },
  errorText: {
    color: colors.red,
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
