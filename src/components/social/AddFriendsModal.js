import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { searchProfiles, followUser, getFollowingIds } from '../../services/social';

const SEARCH_DEBOUNCE_MS = 350;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

export default function AddFriendsModal({ visible, onClose, currentUserId, navigation }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [pendingIds, setPendingIds] = useState(new Set());
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setResults([]);
      setSearching(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      return;
    }
    if (currentUserId) {
      getFollowingIds(currentUserId)
        .then((ids) => setFollowingIds(new Set(ids)))
        .catch((err) => console.error('Failed to load following list:', err));
    }
  }, [visible, currentUserId]);

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
        console.error('Profile search failed:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  const handleFollow = async (profile) => {
    if (!currentUserId || pendingIds.has(profile.user_id)) return;
    setPendingIds((prev) => new Set(prev).add(profile.user_id));
    try {
      await followUser(currentUserId, profile.user_id);
      setFollowingIds((prev) => new Set(prev).add(profile.user_id));
    } catch (err) {
      console.error('Failed to follow user:', err);
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(profile.user_id);
        return next;
      });
    }
  };

  const handleOpenProfile = (profile) => {
    if (!profile.username || !navigation) return;
    onClose();
    navigation.navigate('UserProfile', { username: profile.username });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Add Friends</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={26} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={handleChangeQuery}
            placeholder="Search by username"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>

        {searching ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.red} />
            <Text style={styles.statusText}>Searching…</Text>
          </View>
        ) : query.trim().length > 0 && results.length === 0 ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>No golfers found for "{query.trim()}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.user_id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isFollowing = followingIds.has(item.user_id);
              const isPending = pendingIds.has(item.user_id);
              return (
                <TouchableOpacity style={styles.resultRow} onPress={() => handleOpenProfile(item)} activeOpacity={0.7}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{getInitials(item.full_name || item.username)}</Text>
                  </View>
                  <View style={styles.resultTextWrap}>
                    <Text style={styles.resultName} numberOfLines={1}>
                      {item.full_name || 'Golfer'}
                    </Text>
                    <Text style={styles.resultUsername} numberOfLines={1}>
                      {item.username ? `@${item.username}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followingButton]}
                    onPress={() => handleFollow(item)}
                    disabled={isFollowing || isPending}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                      {isFollowing ? 'Following' : isPending ? '…' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginHorizontal: 20,
    marginTop: 16,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
    height: '100%',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  statusText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 24,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    fontWeight: '600',
  },
  resultUsername: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.red,
  },
  followingButton: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  followButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  followingButtonText: {
    color: colors.muted,
  },
});
