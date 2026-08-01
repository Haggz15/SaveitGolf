import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import VideoPost from '../components/VideoPost';
import AddFriendsModal from '../components/social/AddFriendsModal';
import colors from '../theme/colors';
import { feedPosts as mockFeedPosts, filterPills } from '../data/mockData';
import { HEADER_CONTENT_HEIGHT, PILL_ROW_HEIGHT, TAB_BAR_HEIGHT } from '../theme/layout';
import { useAuth } from '../context/AuthContext';
import { getFeedPosts } from '../services/posts';
import { getFollowingIds } from '../services/social';

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

function PostSlide({ post, height, isActive, onStatePress, onUserPress }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const isVideo = post.isVideo ?? Boolean(post.video);

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

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

      <View style={styles.dimOverlay} />

      <LinearGradient
        colors={['transparent', 'rgba(6, 14, 26, 0.94)']}
        locations={[0, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <View style={styles.topRightStack} pointerEvents="none">
        <Text style={styles.topRightCourseName} numberOfLines={1} ellipsizeMode="tail">
          {post.course}
        </Text>
        {post.hole != null && (
          <View style={styles.holeBadge}>
            <Text style={styles.holeBadgeNumber}>{post.hole}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionRail}>
        <TouchableOpacity style={styles.railButton} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={34}
            color={liked ? colors.red : colors.white}
          />
          <Text style={styles.railText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="chatbubble-outline" size={31} color={colors.white} />
          <Text style={styles.railText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="share-outline" size={32} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => setSaved((prev) => !prev)}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={30}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.leftInfo}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar} />
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
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [activePostId, setActivePostId] = useState(null);
  const [addFriendsVisible, setAddFriendsVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const containerHeight =
    windowHeight - insets.top - HEADER_CONTENT_HEIGHT - PILL_ROW_HEIGHT - TAB_BAR_HEIGHT;

  const loadFeed = useCallback(async () => {
    setLoadingFeed(true);
    try {
      if (activeFilter === 'Following') {
        const followingIds = user?.id ? await getFollowingIds(user.id) : [];
        const realPosts = await getFeedPosts({ userIds: followingIds });
        setPosts(realPosts);
      } else {
        const realPosts = await getFeedPosts();
        // Demo content trails real posts so the feed still has something to
        // browse on Nearby/Top Rated before there's much real activity.
        setPosts([...realPosts, ...mockFeedPosts]);
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
          <TouchableOpacity
            style={styles.addFriendsButton}
            onPress={() => setAddFriendsVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-add" size={22} color={colors.white} />
          </TouchableOpacity>
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
                  onStatePress={handleStatePress}
                  onUserPress={handleUserPress}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  addFriendsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
  topRightStack: {
    position: 'absolute',
    top: 12,
    right: 14,
    alignItems: 'center',
  },
  topRightCourseName: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 13,
    color: colors.white,
    maxWidth: 140,
    textAlign: 'center',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  holeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.red,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holeBadgeNumber: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  actionRail: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    alignItems: 'center',
  },
  railButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  railText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(6, 14, 26, 0.65)',
  },
  stateBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
