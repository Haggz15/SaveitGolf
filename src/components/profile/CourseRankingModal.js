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
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      setCourseName(initialRanking?.courseName ?? '');
      setSelectedCourse(null);
      setCourseResults([]);
      setRating(initialRanking?.rating ?? 5);
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
      Alert.alert('Add a course name', 'Search for and select the course you played.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        courseId: selectedCourse?.id ?? null,
        courseName: courseName.trim(),
        rating: clampRating(rating),
      });
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
