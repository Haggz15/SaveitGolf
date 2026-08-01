import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import VideoPost from '../components/VideoPost';
import AddFriendsModal from '../components/social/AddFriendsModal';
import CommentSheet from '../components/feed/CommentSheet';
import NotificationPanel from '../components/feed/NotificationPanel';
import ShotOfWeekBanner from '../components/feed/ShotOfWeekBanner';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { feedPosts as mockFeedPosts, filterPills } from '../data/mockData';
import { HEADER_CONTENT_HEIGHT, PILL_ROW_HEIGHT, TAB_BAR_HEIGHT } from '../theme/layout';
import { useAuth } from '../context/AuthContext';
import { getFeedPosts, incrementShareCount } from '../services/posts';
import { getFollowingIds } from '../services/social';
import { likePost, unlikePost, getLikedPostIds } from '../services/likes';
import { createNotification, getUnreadNotificationCount } from '../services/notifications';
import { getCurrentShotOfWeek } from '../services/shotOfWeek';
import { savePost, unsavePost, getSavedPostIds } from '../services/savedPosts';
import { saveMediaToDevice } from '../utils/saveMedia';
import { haversineMiles } from '../utils/distance';

function FilterPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PostSlide({
  post,
  height,
  isActive,
  currentUserId,
  initiallyLiked,
  initiallySaved,
  isShotOfWeek,
  onStatePress,
  onUserPress,
  onCommentPress,
  onSaveToast,
}) {
  const [liked, setLiked] = useState(initiallyLiked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(initiallySaved);
  const isVideo = post.isVideo ?? Boolean(post.video);

  async function toggleLike() {
    if (!currentUserId) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((prev) => (next ? prev + 1 : prev - 1));
    try {
      if (next) {
        await likePost(post.id, currentUserId);
        await createNotification({ userId: post.userId, actorId: currentUserId, type: 'like', postId: post.id });
      } else {
        await unlikePost(post.id, currentUserId);
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
      setLiked(!next);
      setLikeCount((prev) => (next ? prev - 1 : prev + 1));
    }
  }

  async function handleShare() {
    try {
      const result = await Share.share({
        message: `Check out ${post.user}'s post on SaveitGolf${post.course ? ` at ${post.course}` : ''}!`,
      });
      if (result.action === Share.sharedAction) {
        incrementShareCount(post.id).catch((err) => console.error('Failed to record share:', err));
        if (currentUserId) {
          await createNotification({ userId: post.userId, actorId: currentUserId, type: 'share', postId: post.id });
        }
      }
    } catch (err) {
      console.error('Failed to share post:', err);
    }
  }

  async function handleToggleSave() {
    if (!currentUserId) return;
    const next = !saved;
    setSaved(next);
    try {
      if (next) {
        await savePost(currentUserId, post.id);
        await saveMediaToDevice(post.mediaUrl);
        onSaveToast?.('Saved to camera roll');
      } else {
        await unsavePost(currentUserId, post.id);
      }
    } catch (err) {
      console.error('Failed to save post:', err);
      setSaved(!next);
      if (next) {
        const message =
          err.message === 'PERMISSION_DENIED'
            ? 'Allow photo library access to save posts to your camera roll.'
            : "Couldn't save this post. Please try again.";
        Alert.alert('Something went wrong', message);
      }
    }
  }

  return (
    <View style={[styles.slide, { height }]}>
      {isVideo ? (
        <VideoPost
          source={post.mediaUrl || post.video}
          mobileSource={post.videoMobile}
          isActive={isActive}
        />
      ) : (
        <Image
          source={post.mediaUrl ? { uri: post.mediaUrl } : post.image}
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          resizeMode="cover"
        />
      )}

      <View style={styles.dimOverlay} pointerEvents="none" />

      <LinearGradient
        colors={['transparent', 'rgba(6, 14, 26, 0.94)']}
        locations={[0, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <View style={styles.topLeftStack} pointerEvents="none">
        <Text style={styles.topLeftCourseName} numberOfLines={2} ellipsizeMode="tail">
          {post.course}
        </Text>
        {post.hole != null && (
          <View style={styles.holeWrap}>
            <Text style={styles.holeLabel}>Hole</Text>
            <Text style={styles.holeNumberLarge}>{post.hole}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRail}>
        <TouchableOpacity style={styles.railButton} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? colors.red : 'rgba(255,255,255,0.85)'}
          />
          <Text style={styles.railText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => onCommentPress(post)}>
          <Ionicons name="chatbubble-outline" size={20} color="rgba(255,255,255,0.85)" />
          <Text style={styles.railText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={handleToggleSave}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={20}
            color={saved ? colors.gold : 'rgba(255,255,255,0.85)'}
          />
        </TouchableOpacity>
      </View>

      {isShotOfWeek && <ShotOfWeekBanner />}

      <View style={styles.leftInfo}>
        <View style={styles.avatarRow}>
          {post.avatarUrl ? (
            <Image source={{ uri: post.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar} />
          )}
          <TouchableOpacity onPress={() => onUserPress(post)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
            <Text style={styles.username}>{post.user}</Text>
          </TouchableOpacity>
          <Text style={styles.timeAgo}>{post.timeAgo}</Text>
        </View>
        <Text style={styles.caption} numberOfLines={2} ellipsizeMode="tail">
          {post.caption}
        </Text>
      </View>

      <TouchableOpacity
        style={styles.stateBadge}
        onPress={() => onStatePress(post)}
        activeOpacity={0.7}
      >
        <Text style={styles.stateBadgeText}>{post.state}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FeedScreen({ navigation }) {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('Following');
  const [posts, setPosts] = useState([]);
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [shotOfWeekPostId, setShotOfWeekPostId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [activePostId, setActivePostId] = useState(null);
  const [addFriendsVisible, setAddFriendsVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [commentPost, setCommentPost] = useState(null);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const containerHeight =
    windowHeight - insets.top - HEADER_CONTENT_HEIGHT - PILL_ROW_HEIGHT - TAB_BAR_HEIGHT;

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      let realPosts;
      if (activeFilter === 'Following') {
        setShotOfWeekPostId(null);
        const followingIds = user?.id ? await getFollowingIds(user.id) : [];
        realPosts = await getFeedPosts({ userIds: followingIds });
        setPosts(realPosts);
      } else if (activeFilter === 'Feed') {
        realPosts = await getFeedPosts({ sort: 'top' });

        // Pin the current Shot of the Week to the top of this pill only —
        // pinning it into "Following" could surface a post from someone the
        // viewer doesn't follow.
        let shotOfWeekPost = null;
        try {
          shotOfWeekPost = await getCurrentShotOfWeek();
        } catch (err) {
          console.error('Failed to load Shot of the Week:', err);
        }
        setShotOfWeekPostId(shotOfWeekPost?.id ?? null);

        const withoutDuplicate = shotOfWeekPost
          ? realPosts.filter((p) => p.id !== shotOfWeekPost.id)
          : realPosts;
        const ordered = shotOfWeekPost ? [shotOfWeekPost, ...withoutDuplicate] : withoutDuplicate;

        // Demo content trails real posts so the feed still has something to
        // browse before there's much real activity.
        setPosts([...ordered, ...mockFeedPosts]);
      } else {
        setShotOfWeekPostId(null);
        // Nearby: sort by distance from the device's current location when
        // permission is granted; otherwise fall back to newest-first.
        realPosts = await getFeedPosts();
        let sorted = realPosts;
        if (Platform.OS !== 'web') {
          try {
            const Location = require('expo-location');
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status === 'granted') {
              const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              const { latitude, longitude } = position.coords;
              sorted = [...realPosts].sort((a, b) => {
                const distA = a.lat != null && a.lng != null ? haversineMiles(latitude, longitude, a.lat, a.lng) : Infinity;
                const distB = b.lat != null && b.lng != null ? haversineMiles(latitude, longitude, b.lat, b.lng) : Infinity;
                return distA - distB;
              });
            }
          } catch (err) {
            // Location unavailable — keep the newest-first order.
          }
        }
        setPosts([...sorted, ...mockFeedPosts]);
      }

      if (user?.id && realPosts?.length) {
        const postIds = realPosts.map((p) => p.id);
        const [liked, saved] = await Promise.all([
          getLikedPostIds(user.id, postIds),
          getSavedPostIds(user.id, postIds),
        ]);
        setLikedPostIds(new Set(liked));
        setSavedPostIds(new Set(saved));
      }
    } catch (err) {
      console.error('Failed to load feed:', err);
      setPosts(activeFilter === 'Following' ? [] : mockFeedPosts);
    } finally {
      setLoadingFeed(false);
    }
  }, [activeFilter, user?.id]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    setActivePostId(posts[0]?.id ?? null);
  }, [posts]);

  useEffect(() => {
    if (!user?.id) return;
    getUnreadNotificationCount(user.id)
      .then(setUnreadCount)
      .catch((err) => console.error('Failed to load unread notification count:', err));
  }, [user?.id]);

  const handleStatePress = (post) => {
    navigation.navigate('Map', {
      state: post.state,
      timestamp: Date.now(),
    });
  };

  const handleUserPress = (post) => {
    if (!post.user) return;
    navigation.navigate('UserProfile', { username: post.user });
  };

  const handleCommentPosted = (postId) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p)));
  };

  // Equivalent of an Intersection Observer for React Native: fires whenever
  // the set of on-screen list items changes so we can play only the post
  // that's actually visible and pause everything else.
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setActivePostId(viewableItems[0].item.id);
    }
  }).current;

  return (
    <View style={styles.screen}>
      <Header
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setNotificationsVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications-outline" size={22} color={colors.white} />
              {unreadCount > 0 && <View style={styles.unreadDot} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerIconButton}
              onPress={() => setAddFriendsVisible(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="person-add" size={22} color={colors.white} />
            </TouchableOpacity>
          </View>
        }
      />
      <View style={styles.pillRow}>
        <FlatList
          data={filterPills}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <FilterPill
              label={item}
              active={activeFilter === item}
              onPress={() => setActiveFilter(item)}
            />
          )}
        />
      </View>

      <View style={styles.pagerContainer}>
        {loadingFeed ? (
          <ActivityIndicator color={colors.red} size="large" style={{ marginTop: 40 }} />
        ) : posts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={36} color={colors.muted} />
            <Text style={styles.emptyStateText}>
              Follow golfers to see their posts here — tap the Add Friends icon above.
            </Text>
          </View>
        ) : (
          containerHeight > 0 && (
            <FlatList
              data={posts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <PostSlide
                  post={item}
                  height={containerHeight}
                  isActive={item.id === activePostId}
                  currentUserId={user?.id}
                  initiallyLiked={likedPostIds.has(item.id)}
                  initiallySaved={savedPostIds.has(item.id)}
                  isShotOfWeek={activeFilter === 'Feed' && item.id === shotOfWeekPostId}
                  onStatePress={handleStatePress}
                  onUserPress={handleUserPress}
                  onCommentPress={setCommentPost}
                  onSaveToast={setToastMessage}
                />
              )}
              pagingEnabled
              showsVerticalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={containerHeight}
              snapToAlignment="start"
              getItemLayout={(_, index) => ({
                length: containerHeight,
                offset: containerHeight * index,
                index,
              })}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
              initialNumToRender={2}
              maxToRenderPerBatch={2}
              windowSize={3}
              removeClippedSubviews
            />
          )
        )}
      </View>

      <AddFriendsModal
        visible={addFriendsVisible}
        onClose={() => setAddFriendsVisible(false)}
        currentUserId={user?.id}
        navigation={navigation}
      />

      <NotificationPanel
        visible={notificationsVisible}
        onClose={() => setNotificationsVisible(false)}
        userId={user?.id}
        onMarkedRead={() => setUnreadCount(0)}
      />

      <CommentSheet
        visible={Boolean(commentPost)}
        onClose={() => setCommentPost(null)}
        post={commentPost}
        currentUserId={user?.id}
        onCommentPosted={handleCommentPosted}
      />

      <Toast message={toastMessage} onHide={() => setToastMessage(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 5,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.red,
    borderWidth: 1.5,
    borderColor: colors.navy,
  },
  pillRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    zIndex: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.navyCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  pillActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  pillText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.white,
  },
  pagerContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    marginTop: 60,
  },
  emptyStateText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 19,
  },
  slide: {
    width: '100%',
    backgroundColor: colors.navyLight,
    position: 'relative',
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
    height: '55%',
  },
  topLeftStack: {
    position: 'absolute',
    top: 12,
    left: 14,
    maxWidth: 170,
  },
  topLeftCourseName: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 13,
    color: colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  holeWrap: {
    marginTop: 6,
  },
  holeLabel: {
    color: colors.offWhite,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  holeNumberLarge: {
    color: colors.white,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  actionRail: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    alignItems: 'center',
  },
  railButton: {
    alignItems: 'center',
    marginBottom: 16,
  },
  railText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  leftInfo: {
    position: 'absolute',
    left: 16,
    right: 60,
    bottom: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navyBorder,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  username: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginRight: 8,
  },
  timeAgo: {
    color: colors.muted,
    fontSize: 10,
  },
  caption: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
  },
  stateBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(6, 14, 26, 0.65)',
  },
  stateBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
