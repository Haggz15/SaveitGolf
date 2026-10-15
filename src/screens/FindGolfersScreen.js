import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  searchGolfers,
  getNearbyGolfers,
  getPopularGolfers,
  getFollowingIds,
  followUser,
  unfollowUser,
} from '../services/social';

const SEARCH_DEBOUNCE_MS = 300;
const NEAR_YOU_COUNT = 8;
const POPULAR_COUNT = 10;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function followerLabel(count) {
  return `${count} ${count === 1 ? 'follower' : 'followers'}`;
}

function GolferRow({ golfer, isFollowing, followerCount, onToggleFollow, onOpen }) {
  return (
    <TouchableOpacity style={styles.row} onPress={() => onOpen(golfer)} activeOpacity={0.7}>
      <View style={styles.avatar}>
        {golfer.avatarUrl ? (
          <Image source={{ uri: golfer.avatarUrl }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarText}>{getInitials(golfer.fullName || golfer.username)}</Text>
        )}
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.username} numberOfLines={1}>
          {golfer.username ? `@${golfer.username}` : golfer.fullName || 'Golfer'}
        </Text>
        <Text style={styles.followerCount}>{followerLabel(followerCount)}</Text>
      </View>
      <TouchableOpacity
        style={[styles.followButton, isFollowing && styles.followingButton]}
        onPress={() => onToggleFollow(golfer)}
        activeOpacity={0.8}
      >
        <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
          {isFollowing ? 'Unfollow' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// Replaces the old Add Friends modal: live search plus two discovery lists
// ("Golfers Near You", "Popular on SaveitGolf") while the search is empty.
export default function FindGolfersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);
  const searchRequestRef = useRef(0);

  const [nearYou, setNearYou] = useState([]);
  const [popular, setPopular] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  // The state Near You matched on, or null if the user has none yet.
  const [nearYouState, setNearYouState] = useState(null);

  const [followingIds, setFollowingIds] = useState(new Set());
  // Optimistic +1/-1 per user on top of the follower_count each row was
  // fetched with, so the count moves the instant Follow/Unfollow is tapped.
  const [countDeltas, setCountDeltas] = useState({});
  // A user's latest tap wins: a request finishing after a newer tap on the
  // same row must not roll that newer state back.
  const toggleSeqRef = useRef({});

  // Re-read on focus — following someone from their profile (pushed from
  // here) should show as followed when coming back.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      getFollowingIds(userId)
        .then((ids) => setFollowingIds(new Set(ids)))
        .catch((err) => console.error('Failed to load following list:', err));
    }, [userId])
  );

  // Suggestions load once per visit; following someone here keeps them listed for the rest
  // of the visit (now showing Unfollow).
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    (async () => {
      setSuggestionsLoading(true);
      const followed = await getFollowingIds(userId).catch((err) => {
        console.error('Failed to load following list:', err);
        return [];
      });
      // Near You skips everyone already followed; Popular only skips the
      // user themselves (see getPopularGolfers).
      const [near, top] = await Promise.all([
        getNearbyGolfers({ userId, limit: NEAR_YOU_COUNT, excludeIds: [userId, ...followed] }).catch((err) => {
          console.error('Failed to load golfers near you:', err);
          return { state: null, golfers: [] };
        }),
        getPopularGolfers({ limit: POPULAR_COUNT, excludeIds: [userId] }).catch((err) => {
          console.error('Failed to load popular golfers:', err);
          return [];
        }),
      ]);
      if (cancelled) return;
      setNearYouState(near.state);
      setNearYou(near.golfers);
      setPopular(top);
      setSuggestionsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => () => debounceRef.current && clearTimeout(debounceRef.current), []);

  const handleChangeQuery = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const requestId = ++searchRequestRef.current;

    const trimmed = text.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const rows = await searchGolfers(trimmed, userId);
        if (requestId === searchRequestRef.current) setResults(rows);
      } catch (err) {
        console.error('Golfer search failed:', err);
        if (requestId === searchRequestRef.current) setResults([]);
      } finally {
        if (requestId === searchRequestRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  };

  function applyFollowState(targetId, follow) {
    setFollowingIds((prev) => {
      const next = new Set(prev);
      if (follow) next.add(targetId);
      else next.delete(targetId);
      return next;
    });
    setCountDeltas((prev) => ({ ...prev, [targetId]: (prev[targetId] ?? 0) + (follow ? 1 : -1) }));
  }

  async function handleToggleFollow(golfer) {
    if (!userId) return;
    const targetId = golfer.userId;
    const follow = !followingIds.has(targetId);
    const seq = (toggleSeqRef.current[targetId] ?? 0) + 1;
    toggleSeqRef.current[targetId] = seq;

    applyFollowState(targetId, follow);
    try {
      if (follow) await followUser(userId, targetId);
      else await unfollowUser(userId, targetId);
    } catch (err) {
      console.error(`Failed to ${follow ? 'follow' : 'unfollow'} user:`, err);
      if (toggleSeqRef.current[targetId] === seq) applyFollowState(targetId, !follow);
    }
  }

  function handleOpenProfile(golfer) {
    if (!golfer.username) return;
    navigation.navigate('UserProfile', { username: golfer.username });
  }

  function renderRow(golfer) {
    return (
      <GolferRow
        key={golfer.userId}
        golfer={golfer}
        isFollowing={followingIds.has(golfer.userId)}
        followerCount={Math.max(0, golfer.followerCount + (countDeltas[golfer.userId] ?? 0))}
        onToggleFollow={handleToggleFollow}
        onOpen={handleOpenProfile}
      />
    );
  }

  const isSearching = query.trim().length > 0;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.red} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Golfers</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChangeQuery}
          placeholder="Search for golfers..."
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleChangeQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        searching ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={colors.red} />
            <Text style={styles.statusText}>Searching…</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>No golfers found for "{query.trim()}"</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.userId}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            renderItem={({ item }) => renderRow(item)}
          />
        )
      ) : suggestionsLoading ? (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.red} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Golfers Near You</Text>
          {nearYou.length ? (
            nearYou.map(renderRow)
          ) : (
            <Text style={styles.sectionEmpty}>
              {nearYouState
                ? `No other golfers in ${nearYouState} yet.`
                : 'Post a round or add a course to see golfers near you.'}
            </Text>
          )}

          <Text style={[styles.sectionTitle, styles.sectionTitleSpaced]}>Popular on SaveitGolf</Text>
          {popular.length ? (
            popular.map(renderRow)
          ) : (
            <Text style={styles.sectionEmpty}>No other golfers on SaveitGolf yet.</Text>
          )}
        </ScrollView>
      )}
    </View>
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
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  backButton: {
    width: 32,
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
  sectionTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionTitleSpaced: {
    marginTop: 24,
  },
  sectionEmpty: {
    color: colors.muted,
    fontSize: 13,
    paddingVertical: 12,
  },
  row: {
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
  rowTextWrap: {
    flex: 1,
  },
  username: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  followerCount: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    minWidth: 88,
    alignItems: 'center',
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
