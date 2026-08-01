import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import {
  getProfileByUsername,
  followUser,
  unfollowUser,
  getFollowStatus,
  getFollowerCount,
  getFollowingCount,
} from '../services/social';
import { getUserPosts, getPostsCount } from '../services/posts';
import { getTopCoursesForUser } from '../services/scorecards';

const TABS = ['Top Courses', 'Uploads'];

function getInitials(fullName) {
  if (!fullName) return '';
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function scoreDiffLabel(score, par) {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function TopCoursesList({ courses, loading }) {
  if (loading) {
    return <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />;
  }
  if (courses.length === 0) {
    return <Text style={styles.emptyText}>No scorecards logged yet.</Text>;
  }
  return (
    <View>
      {courses.map((item) => (
        <View key={item.courseId || item.courseName} style={styles.listRow}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankBadgeText}>{item.rank}</Text>
          </View>
          <Text style={styles.listRowTitle} numberOfLines={1}>
            {item.courseName}
          </Text>
          <View style={styles.scoreBlock}>
            <Text style={styles.listRowScore}>{item.bestScore}</Text>
            <Text style={styles.listRowDiff}>{scoreDiffLabel(item.bestScore, item.par)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function UploadsGrid({ posts, loading }) {
  if (loading) {
    return <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />;
  }
  if (posts.length === 0) {
    return <Text style={styles.emptyText}>No posts yet.</Text>;
  }
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => item.id}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 8 }}
      contentContainerStyle={{ gap: 8 }}
      renderItem={({ item }) => (
        <View style={styles.uploadTile}>
          <Image source={{ uri: item.mediaUrl }} style={styles.uploadTileImage} resizeMode="cover" />
          {item.isVideo && (
            <View style={styles.uploadPlayBadge}>
              <Ionicons name="play" size={10} color={colors.white} />
            </View>
          )}
        </View>
      )}
    />
  );
}

export default function OtherUserProfileScreen({ route, navigation }) {
  const { username } = route.params ?? {};
  const { user: currentUser } = useAuth();
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [topCourses, setTopCourses] = useState([]);
  const [topCoursesLoading, setTopCoursesLoading] = useState(true);
  const [uploads, setUploads] = useState([]);
  const [uploadsLoading, setUploadsLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setNotFound(false);
    try {
      const row = await getProfileByUsername(username);
      if (!row) {
        setNotFound(true);
        setProfile(null);
        return;
      }
      setProfile(row);

      const [followers, following, postsCount] = await Promise.all([
        getFollowerCount(row.user_id),
        getFollowingCount(row.user_id),
        getPostsCount(row.user_id),
      ]);
      setStats({ followers, following, posts: postsCount });

      if (currentUser?.id && currentUser.id !== row.user_id) {
        setIsFollowing(await getFollowStatus(currentUser.id, row.user_id));
      }

      setTopCoursesLoading(true);
      getTopCoursesForUser(row.user_id)
        .then(setTopCourses)
        .catch((err) => console.error('Failed to load top courses:', err))
        .finally(() => setTopCoursesLoading(false));

      setUploadsLoading(true);
      getUserPosts(row.user_id)
        .then(setUploads)
        .catch((err) => console.error('Failed to load uploads:', err))
        .finally(() => setUploadsLoading(false));
    } catch (err) {
      console.error('Failed to load profile:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [username, currentUser?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleToggleFollow = async () => {
    if (!currentUser?.id || !profile?.user_id || followBusy) return;
    setFollowBusy(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.id, profile.user_id);
        setIsFollowing(false);
        setStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await followUser(currentUser.id, profile.user_id);
        setIsFollowing(true);
        setStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error('Failed to update follow status:', err);
    } finally {
      setFollowBusy(false);
    }
  };

  const isSelf = currentUser?.id && profile?.user_id === currentUser.id;

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile?.username ? `@${profile.username}` : username ?? 'Profile'}
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.red} size="large" style={{ marginTop: 40 }} />
      ) : notFound ? (
        <Text style={styles.emptyText}>Couldn't find that golfer.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarInitials}>{getInitials(profile?.full_name)}</Text>
                )}
              </View>
            </View>
            <Text style={styles.name}>{profile?.full_name || 'Golfer'}</Text>
            <Text style={styles.handle}>{profile?.username ? `@${profile.username}` : ''}</Text>
            {profile?.home_state && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.muted} />
                <Text style={styles.locationText}>{profile.home_state}</Text>
              </View>
            )}

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.followers}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.following}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stats.posts}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>

            {!isSelf && (
              <TouchableOpacity
                style={[styles.followButton, isFollowing && styles.followingButton]}
                onPress={handleToggleFollow}
                disabled={followBusy}
                activeOpacity={0.85}
              >
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.scorecardsButton}
              onPress={() =>
                navigation.navigate('UserScorecards', {
                  userId: profile?.user_id,
                  displayName: profile?.full_name || 'Golfer',
                })
              }
              activeOpacity={0.85}
            >
              <Ionicons name="reader-outline" size={16} color={colors.white} />
              <Text style={styles.scorecardsButtonText}>Scorecards</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {TABS.map((tab) => (
              <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                {activeTab === tab && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'Top Courses' ? (
            <TopCoursesList courses={topCourses} loading={topCoursesLoading} />
          ) : (
            <UploadsGrid posts={uploads} loading={uploadsLoading} />
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
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  tabContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 26,
    fontWeight: '700',
  },
  name: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '700',
  },
  handle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  locationText: {
    color: colors.muted,
    fontSize: 12,
    marginLeft: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 18,
    marginBottom: 18,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
  followButton: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  followButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  followingButtonText: {
    color: colors.offWhite,
  },
  scorecardsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.red,
    borderRadius: 12,
    paddingVertical: 12,
    width: '100%',
    marginTop: 10,
  },
  scorecardsButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    marginTop: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.white,
  },
  tabIndicator: {
    marginTop: 8,
    height: 3,
    width: '60%',
    backgroundColor: colors.red,
    borderRadius: 2,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankBadgeText: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 12,
  },
  listRowTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  scoreBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  listRowScore: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginRight: 6,
  },
  listRowDiff: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 13,
  },
  uploadTile: {
    flex: 1 / 3,
    aspectRatio: 1,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 10,
    marginTop: 16,
    overflow: 'hidden',
  },
  uploadTileImage: {
    ...StyleSheet.absoluteFillObject,
  },
  uploadPlayBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
