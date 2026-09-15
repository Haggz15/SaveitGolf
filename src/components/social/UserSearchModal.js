import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchProfiles } from '../../services/social';

const SEARCH_DEBOUNCE_MS = 350;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

// A plain "look someone up" search — distinct from AddFriendsModal, which
// is the discovery flow with a Follow button on every row. This one just
// finds a golfer by name/username and opens their profile.
export default function UserSearchModal({ visible, onClose, currentUserId, navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSearching(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }
  }, [visible]);

  const handleChangeQuery = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = text.trim();
    if (trimmed.length < 2) {
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
        console.error('User search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleClose = () => {
    onClose();
  };

  const handleOpenProfile = (profile) => {
    if (!profile.username) return;
    onClose();
    navigation.navigate('UserProfile', { username: profile.username });
  };

  return (
    <Modal visible={visible} animationType="slide" supportedOrientations={['portrait']} onRequestClose={handleClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={handleChangeQuery}
            placeholder="Search golfers by name or username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {searching ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.red} />
            <Text style={styles.statusText}>Searching…</Text>
          </View>
        ) : query.trim().length > 1 && results.length === 0 ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>No golfers found for "{query.trim()}"</Text>
          </View>
        ) : query.trim().length < 2 ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>Search for golfers by name or username</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.user_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.resultRow} onPress={() => handleOpenProfile(item)} activeOpacity={0.7}>
                <View style={styles.avatar}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>{getInitials(item.full_name || item.username)}</Text>
                  )}
                </View>
                <View style={styles.resultTextWrap}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {item.full_name || item.username || 'Golfer'}
                  </Text>
                  <Text style={styles.resultUsername} numberOfLines={1}>
                    {item.username ? `@${item.username}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            )}
          />
        )}
      </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  input: {
    flex: 1,
    backgroundColor: colors.navyCard,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.white,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  cancelText: {
    color: colors.brightGreen,
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 32,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  resultTextWrap: {
    flex: 1,
  },
  resultName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  resultUsername: {
    color: '#6a8ab0',
    fontSize: 12,
    marginTop: 2,
  },
});
