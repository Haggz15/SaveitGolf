import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import VideoPost from '../components/VideoPost';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  getSotwNominees,
  getSotwVote,
  getSotwVoteCounts,
  castSotwVote,
  isSotwVotingOpen,
  getSotwVotingDeadline,
} from '../services/shotOfWeek';

// Postgres unique_violation — the (user_id, week_start) constraint, i.e.
// this user already voted this week (e.g. from another device).
const UNIQUE_VIOLATION = '23505';

function formatDeadline(deadline) {
  // The deadline is midnight at the end of Sunday, so name the day before it.
  const sunday = new Date(deadline.getTime() - 1);
  const date = sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `Voting closes Sunday ${date} at midnight`;
}

function FinalistSlide({
  post,
  height,
  isActive,
  isMuted,
  setIsMuted,
  showResults,
  votes,
  totalVotes,
  isMyVote,
  canVote,
  voting,
  onVote,
}) {
  const [userPaused, setUserPaused] = useState(false);
  const videoTapFeedback = useRef(null);
  const isVideo = post.isVideo ?? Boolean(post.video);
  const percent = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

  useEffect(() => {
    if (!isActive) setUserPaused(false);
  }, [isActive]);

  function handleSlideTap() {
    if (!isVideo) return;
    setUserPaused((prev) => !prev);
    if (videoTapFeedback.current) videoTapFeedback.current();
  }

  return (
    <TouchableWithoutFeedback onPress={handleSlideTap}>
      <View style={[styles.slide, { height }]}>
        {isVideo ? (
          <VideoPost
            source={post.mediaUrl || post.video}
            isActive={isActive}
            muted={isMuted}
            setMuted={setIsMuted}
            userPaused={userPaused}
            onTap={videoTapFeedback}
          />
        ) : (
          <Image
            source={{ uri: post.mediaUrl }}
            style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
            resizeMode="cover"
          />
        )}

        <View style={styles.dimOverlay} pointerEvents="none" />
        <LinearGradient
          colors={['transparent', 'rgba(6, 14, 26, 0.94)']}
          style={styles.bottomGradient}
          pointerEvents="none"
        />

        <View style={styles.topLeftStack} pointerEvents="none">
          <Text style={styles.courseName}>{post.course}</Text>
          {post.subCourseName ? (
            <Text style={styles.compositeName} numberOfLines={1}>
              {post.subCourseName}
            </Text>
          ) : post.compositeName && post.compositeName !== post.nineName ? (
            <Text style={styles.compositeName} numberOfLines={1}>
              {post.compositeName}
            </Text>
          ) : null}
          {(post.hole != null || post.nineName) && (
            <View style={styles.holeRow}>
              {post.hole != null && (
                <View style={styles.holeWrap}>
                  <Text style={styles.holeLabel}>Hole</Text>
                  <Text style={styles.holeNumber}>{post.hole}</Text>
                </View>
              )}
              {post.nineName && (
                <View style={styles.holeWrap}>
                  <Text style={styles.holeLabel}>{post.nineName.includes(' + ') ? 'Nines' : 'Nine'}</Text>
                  <Text style={styles.nineName} numberOfLines={1}>
                    {post.nineName}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.likeBadge} pointerEvents="none">
          <Ionicons name="heart" size={26} color={colors.red} style={styles.iconShadow} />
          <Text style={styles.likeCount}>{post.likes}</Text>
        </View>

        <View style={styles.bottomInfo}>
          <View style={styles.avatarRow}>
            {post.avatarUrl ? (
              <Image source={{ uri: post.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatar} />
            )}
            <Text style={styles.username}>{post.user}</Text>
            <Text style={styles.timeAgo}>{post.timeAgo}</Text>
          </View>
          {post.caption ? (
            <Text style={styles.caption} numberOfLines={2}>
              {post.caption}
            </Text>
          ) : null}

          {showResults && (
            <View style={[styles.results, isMyVote && styles.resultsMine]}>
              <View style={styles.resultsTextRow}>
                <Text style={styles.resultsPercent}>{percent}%</Text>
                <Text style={styles.resultsVotes}>
                  {votes} {votes === 1 ? 'vote' : 'votes'}
                  {isMyVote ? ' · Your vote' : ''}
                </Text>
              </View>
              <View style={styles.resultsTrack}>
                <View style={[styles.resultsFill, { width: `${percent}%` }]} />
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.voteButton, (!canVote || voting) && styles.voteButtonDisabled, isMyVote && styles.voteButtonMine]}
            onPress={onVote}
            disabled={!canVote || voting}
            activeOpacity={0.85}
          >
            {voting ? (
              <ActivityIndicator color={colors.navy} />
            ) : (
              <Text style={styles.voteButtonText}>{isMyVote ? '✓ Voted' : '🏆 Vote'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}

export default function SotwVotingScreen({ navigation }) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [nominees, setNominees] = useState([]);
  const [counts, setCounts] = useState({});
  const [votedPostId, setVotedPostId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [votingPostId, setVotingPostId] = useState(null);
  const [activePostId, setActivePostId] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [pagerHeight, setPagerHeight] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const votingOpen = isSotwVotingOpen();

  const load = useCallback(async () => {
    try {
      const [posts, voteCounts, myVote] = await Promise.all([
        getSotwNominees(),
        getSotwVoteCounts(),
        getSotwVote(user?.id),
      ]);
      setNominees(posts);
      setCounts(voteCounts);
      setVotedPostId(myVote);
      setActivePostId((prev) => prev ?? posts[0]?.id ?? null);
    } catch (err) {
      console.error('Failed to load Shot of the Week finalists:', err);
      setToastMessage('Could not load the finalists — please try again');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleVote(postId) {
    if (!user?.id || votedPostId || votingPostId || !votingOpen) return;
    setVotingPostId(postId);
    try {
      await castSotwVote(user.id, postId);
      setVotedPostId(postId);
      setCounts((prev) => ({ ...prev, [postId]: (prev[postId] ?? 0) + 1 }));
    } catch (err) {
      if (err?.code === UNIQUE_VIOLATION) {
        // Already voted this week somewhere else — show the real results.
        await load();
      } else if (err?.code === 'SOTW_VOTING_CLOSED') {
        setToastMessage(err.message);
      } else {
        console.error('Failed to cast Shot of the Week vote:', err);
        setToastMessage('Could not save your vote — please try again');
      }
    } finally {
      setVotingPostId(null);
    }
  }

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 90, minimumViewTime: 100 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const visible = viewableItems.find((v) => v.isViewable);
    if (visible) setActivePostId(visible.item.id);
  }).current;

  const showResults = Boolean(votedPostId) || !votingOpen;
  const totalVotes = Object.values(counts).reduce((sum, n) => sum + n, 0);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={colors.red} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Vote for Shot of the Week</Text>
          <Text style={styles.headerSubtitle}>
            {votingOpen ? formatDeadline(getSotwVotingDeadline()) : 'Voting is closed — winner announced Monday'}
          </Text>
        </View>
      </View>

      <View style={styles.pager} onLayout={(e) => setPagerHeight(Math.round(e.nativeEvent.layout.height))}>
        {loading ? (
          <ActivityIndicator color={colors.red} size="large" style={styles.spinner} />
        ) : nominees.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No finalists to vote on right now. Check back Friday!</Text>
          </View>
        ) : (
          pagerHeight > 0 && (
            <FlatList
              data={nominees}
              keyExtractor={(item) => item.id}
              extraData={{ counts, votedPostId, votingPostId, activePostId, isFocused, isMuted }}
              renderItem={({ item }) => (
                <FinalistSlide
                  post={item}
                  height={pagerHeight}
                  isActive={item.id === activePostId && isFocused}
                  isMuted={isMuted}
                  setIsMuted={setIsMuted}
                  showResults={showResults}
                  votes={counts[item.id] ?? 0}
                  totalVotes={totalVotes}
                  isMyVote={item.id === votedPostId}
                  canVote={votingOpen && !votedPostId && Boolean(user?.id)}
                  voting={item.id === votingPostId}
                  onVote={() => handleVote(item.id)}
                />
              )}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={pagerHeight}
              snapToAlignment="start"
              getItemLayout={(_, index) => ({ length: pagerHeight, offset: pagerHeight * index, index })}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              windowSize={3}
              initialNumToRender={2}
            />
          )
        )}
      </View>

      <Toast message={toastMessage} type="error" onHide={() => setToastMessage(null)} />
    </View>
  );
}

const textShadow = {
  textShadowColor: 'rgba(0, 0, 0, 0.8)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 4,
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerText: {
    flex: 1,
    marginLeft: 10,
  },
  headerTitle: {
    fontFamily: 'AbrilFatface_400Regular',
    color: colors.gold,
    fontSize: 20,
  },
  headerSubtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  pager: {
    flex: 1,
  },
  spinner: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
  },
  slide: {
    width: '100%',
    backgroundColor: colors.navyLight,
    overflow: 'hidden',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 26, 0.15)',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
  },
  topLeftStack: {
    position: 'absolute',
    top: 12,
    left: 14,
    maxWidth: 220,
  },
  courseName: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  compositeName: {
    fontFamily: 'Cinzel_700Bold',
    fontStyle: 'italic',
    fontSize: 11,
    color: colors.lightBlue,
    marginTop: 2,
    ...textShadow,
  },
  holeRow: {
    flexDirection: 'row',
    gap: 14,
  },
  holeWrap: {
    marginTop: 6,
    alignItems: 'center',
  },
  holeLabel: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  holeNumber: {
    color: colors.red,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  nineName: {
    color: colors.red,
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 30,
  },
  likeBadge: {
    position: 'absolute',
    right: 12,
    bottom: 200,
    alignItems: 'center',
  },
  iconShadow: {
    textShadowColor: 'rgba(0, 0, 0, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  likeCount: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    ...textShadow,
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginRight: 44,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navyBorder,
    marginRight: 8,
  },
  username: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
    marginRight: 8,
    ...textShadow,
  },
  timeAgo: {
    color: colors.muted,
    fontSize: 10,
  },
  caption: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    marginRight: 44,
    ...textShadow,
  },
  results: {
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 14, 26, 0.7)',
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  resultsMine: {
    borderColor: colors.gold,
  },
  resultsTextRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  resultsPercent: {
    color: colors.gold,
    fontSize: 20,
    fontWeight: '800',
    marginRight: 8,
  },
  resultsVotes: {
    color: colors.offWhite,
    fontSize: 13,
  },
  resultsTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.navyBorder,
    overflow: 'hidden',
  },
  resultsFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.gold,
  },
  voteButton: {
    marginTop: 12,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteButtonDisabled: {
    opacity: 0.45,
  },
  voteButtonMine: {
    opacity: 1,
  },
  voteButtonText: {
    color: colors.navy,
    fontSize: 17,
    fontWeight: '800',
  },
});
