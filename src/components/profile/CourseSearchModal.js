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
  StyleSheet,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchCourses } from '../../services/golfCourseApi';

const SEARCH_DEBOUNCE_MS = 400;

// Tap-to-add course search: unlike CourseRankingModal (which builds up a
// rating before saving), selecting a result here adds it to My Courses
// immediately — there's nothing else to fill in. When search comes up empty,
// `onAddManualCourse` lets the user add a course golfcourseapi.com doesn't
// know about by typing in the name/city/state themselves.
export default function CourseSearchModal({ visible, onClose, onAddCourse, onAddManualCourse }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualName, setManualName] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [savingManual, setSavingManual] = useState(false);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setAddingId(null);
      setManualMode(false);
      setManualName('');
      setManualCity('');
      setManualState('');
      setSavingManual(false);
    } else if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
  }, [visible]);

  function handleChangeQuery(text) {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (text.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const courses = await searchCourses(text.trim());
        setResults(courses);
      } catch (err) {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }

  async function handleSelectCourse(course) {
    if (addingId) return;
    setAddingId(course.id);
    try {
      await onAddCourse(course);
      onClose();
    } catch (err) {
      // Mirrors CourseRankingModal's handleSave catch block. Keep the modal
      // open so the user can retry instead of losing their search.
      console.error('Failed to add course:', err);
      Alert.alert('Something went wrong', 'Could not add this course. Please try again.');
    } finally {
      setAddingId(null);
    }
  }

  function handleOpenManualEntry() {
    setManualName(query.trim());
    setManualCity('');
    setManualState('');
    setManualMode(true);
  }

  function isManualFormValid() {
    return Boolean(manualName.trim() && manualCity.trim() && manualState.trim().length === 2);
  }

  async function handleSaveManualCourse() {
    if (savingManual || !isManualFormValid()) return;
    setSavingManual(true);
    try {
      await onAddManualCourse({
        name: manualName.trim(),
        city: manualCity.trim(),
        state: manualState.trim(),
      });
      onClose();
    } catch (err) {
      // Mirrors CourseRankingModal's handleSave catch block. Keep the form
      // open so the user can retry.
      console.error('Failed to add manual course:', err);
      Alert.alert('Something went wrong', 'Could not add this course. Please try again.');
    } finally {
      setSavingManual(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{manualMode ? 'Add Course Manually' : 'Add Course'}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {manualMode ? (
          <View style={styles.content}>
            <TouchableOpacity
              style={styles.backToSearchRow}
              onPress={() => setManualMode(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="arrow-back" size={16} color={colors.muted} />
              <Text style={styles.backToSearchText}>Back to search</Text>
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Course name</Text>
            <TextInput
              style={styles.input}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Course name"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoFocus
            />

            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={manualCity}
              onChangeText={setManualCity}
              placeholder="City"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
            />

            <Text style={styles.fieldLabel}>State</Text>
            <TextInput
              style={styles.input}
              value={manualState}
              onChangeText={(text) => setManualState(text.toUpperCase())}
              placeholder="e.g. PA"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="characters"
              maxLength={2}
            />

            <Text style={styles.manualHintText}>
              City and state are used to place this course on the map.
            </Text>

            <TouchableOpacity
              style={[styles.saveManualButton, (!isManualFormValid() || savingManual) && styles.saveManualButtonDisabled]}
              onPress={handleSaveManualCourse}
              disabled={!isManualFormValid() || savingManual}
              activeOpacity={0.85}
            >
              {savingManual ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.saveManualButtonText}>Add Course</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={handleChangeQuery}
              placeholder="Search for a course"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoFocus
            />

            {query.trim().length < 2 ? (
              <Text style={styles.statusText}>Search by course name to add it to Courses Played.</Text>
            ) : searching ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color={colors.red} />
                <Text style={styles.statusText}>Searching…</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={styles.noResultsWrap}>
                <Text style={styles.statusText}>No courses found.</Text>
                <TouchableOpacity style={styles.manualEntryButton} onPress={handleOpenManualEntry} activeOpacity={0.85}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.red} />
                  <Text style={styles.manualEntryButtonText}>Add "{query.trim()}" manually</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.resultsList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.resultRow}
                    onPress={() => handleSelectCourse(item)}
                    disabled={Boolean(addingId)}
                  >
                    <Ionicons name="flag-outline" size={16} color={colors.red} />
                    <View style={styles.resultTextWrap}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultLocation} numberOfLines={1}>
                        {[item.city, item.state].filter(Boolean).join(', ') || 'Location unknown'}
                      </Text>
                    </View>
                    {addingId === item.id ? (
                      <ActivityIndicator size="small" color={colors.red} />
                    ) : (
                      <Ionicons name="add-circle-outline" size={22} color={colors.muted} />
                    )}
                  </TouchableOpacity>
                )}
              />
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
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 18,
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
    marginBottom: 16,
  },
  resultsList: {
    flex: 1,
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
    marginTop: 8,
  },
  noResultsWrap: {
    alignItems: 'center',
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.red,
  },
  manualEntryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  backToSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  backToSearchText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  manualHintText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 4,
  },
  saveManualButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
  },
  saveManualButtonDisabled: {
    opacity: 0.5,
  },
  saveManualButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
