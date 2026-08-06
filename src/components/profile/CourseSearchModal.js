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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchCourses } from '../../services/golfCourseApi';

const SEARCH_DEBOUNCE_MS = 400;

// Tap-to-add course search: unlike CourseRankingModal (which builds up a
// rating before saving), selecting a result here adds it to My Courses
// immediately — there's nothing else to fill in.
export default function CourseSearchModal({ visible, onClose, onAddCourse }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const searchTimer = useRef(null);

  useEffect(() => {
    if (visible) {
      setQuery('');
      setResults([]);
      setAddingId(null);
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
      // Save failed — error is already surfaced to the user by onAddCourse.
      // Keep the modal open so they can retry instead of losing their search.
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.screen, { paddingTop: insets.top + 12 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Course</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

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
            <Text style={styles.statusText}>Search by course name to add it to My Courses.</Text>
          ) : searching ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.red} />
              <Text style={styles.statusText}>Searching…</Text>
            </View>
          ) : results.length === 0 ? (
            <Text style={styles.statusText}>No courses found.</Text>
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
});
