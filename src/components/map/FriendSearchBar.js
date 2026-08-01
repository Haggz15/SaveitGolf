import { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchProfiles } from '../../services/social';

const SEARCH_DEBOUNCE_MS = 350;

export default function FriendSearchBar({ currentUserId, onSelectFriend }) {
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const collapse = () => {
    setExpanded(false);
    setQuery('');
    setResults([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  };

  const handleChangeQuery = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const rows = await searchProfiles(trimmed, currentUserId);
        setResults(rows);
      } catch (err) {
        console.error('Friend search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleSelect = (profile) => {
    onSelectFriend(profile);
    collapse();
  };

  if (!expanded) {
    return (
      <TouchableOpacity style={styles.collapsedRow} onPress={() => setExpanded(true)} activeOpacity={0.8}>
        <Ionicons name="people-outline" size={16} color={colors.muted} style={{ marginRight: 8 }} />
        <Text style={styles.collapsedText}>Search Friends</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.searchRow}>
        <Ionicons name="people" size={18} color={colors.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeQuery}
          placeholder="Search a friend's username"
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
        />
        <TouchableOpacity onPress={collapse} style={styles.clearButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {query.trim().length > 0 && (
        <View style={styles.dropdown}>
          {searching ? (
            <View style={styles.statusRow}>
              <ActivityIndicator size="small" color={colors.red} />
              <Text style={styles.statusText}>Searching…</Text>
            </View>
          ) : results.length === 0 ? (
            <View style={styles.statusRow}>
              <Text style={styles.statusText}>No golfers found</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.user_id}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultRow} onPress={() => handleSelect(item)}>
                  <Ionicons name="person-circle-outline" size={20} color={colors.red} style={styles.resultIcon} />
                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.full_name || 'Golfer'}
                    </Text>
                    <Text style={styles.resultUsername} numberOfLines={1}>
                      {item.username ? `@${item.username}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  collapsedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignSelf: 'flex-start',
  },
  collapsedText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  wrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.navy,
    zIndex: 2000,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    height: '100%',
  },
  clearButton: {
    marginLeft: 8,
  },
  dropdown: {
    marginTop: 6,
    maxHeight: 260,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 260,
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
  resultIcon: {
    marginTop: 1,
  },
  resultTextWrap: {
    flex: 1,
  },
  resultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  resultUsername: {
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
  },
});
