import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getCourseById } from '../services/golfCourseApi';
import { courseDetail, postFilters } from '../data/mockData';

const TABS = ['All Posts', 'Hole by Hole', 'Scorecards'];

// Typical 18-hole par distribution, used whenever live tee data hasn't
// loaded (or isn't available) so the Hole by Hole grid always has content.
const DEFAULT_HOLE_PATTERN = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5];

function scoreDiffLabel(score, par) {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function FilterPill({ label, active, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PostTile({ post }) {
  const isVideo = post.type === 'video';
  return (
    <View style={[styles.postTile, { backgroundColor: post.bg }]}>
      <Ionicons
        name={isVideo ? 'videocam-outline' : 'image-outline'}
        size={22}
        color={colors.muted}
      />
      {isVideo && (
        <View style={styles.playButton}>
          <Ionicons name="play" size={9} color={colors.white} />
        </View>
      )}
      <View style={styles.tileLikeRow}>
        <Ionicons name="heart" size={12} color={colors.white} />
        <Text style={styles.tileLikeText}>{post.likes}</Text>
      </View>
    </View>
  );
}

function HoleCard({ number, par, yardage, postCount, isMostPopular, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.holeCard, isMostPopular && styles.holeCardPopular]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.holeCardNumber}>{number}</Text>
      <Text style={styles.holeCardMeta}>
        Par {par}{yardage ? ` · ${yardage} yds` : ''}
      </Text>
      <View style={styles.holeCardPostsRow}>
        <Ionicons name="image-outline" size={12} color={colors.red} />
        <Text style={styles.holeCardPosts}>{postCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ScorecardRow({ entry }) {
  const diff = entry.score - entry.par;
  const diffColor = diff < 0 ? colors.green : diff > 0 ? colors.red : colors.offWhite;
  return (
    <View style={styles.scorecardRow}>
      <View style={styles.scorecardAvatar}>
        <Text style={styles.scorecardAvatarText}>{entry.initials}</Text>
      </View>
      <View style={styles.scorecardInfo}>
        <Text style={styles.scorecardName}>{entry.name}</Text>
        <Text style={styles.scorecardDate}>{entry.date}</Text>
      </View>
      <View style={styles.scorecardScoreBlock}>
        <Text style={styles.scorecardScore}>{entry.score}</Text>
        <Text style={[styles.scorecardDiff, { color: diffColor }]}>
          {scoreDiffLabel(entry.score, entry.par)}
        </Text>
      </View>
    </View>
  );
}

function BottomNavButton({ icon, iconFocused, label, focused, onPress }) {
  return (
    <TouchableOpacity style={styles.navButton} onPress={onPress} activeOpacity={0.7}>
      <Ionicons
        name={focused ? iconFocused : icon}
        size={22}
        color={focused ? colors.red : colors.muted}
      />
      <Text style={[styles.navButtonLabel, focused && styles.navButtonLabelActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CourseDetailScreen({ route, navigation }) {
  const { courseId, courseName, city, state } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const [tees, setTees] = useState(null);
  const [activeTab, setActiveTab] = useState(TABS[0]);
  const [activeFilter, setActiveFilter] = useState(postFilters[0]);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) return undefined;
    getCourseById(courseId)
      .then((course) => {
        if (!cancelled) setTees(course.tees ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const primaryTee = tees?.male?.[0] ?? tees?.female?.[0] ?? null;
  const holesCount = primaryTee?.holes?.length ?? 18;
  const parTotal = primaryTee?.par_total ?? 72;

  const holes = useMemo(() => {
    return Array.from({ length: holesCount }, (_, index) => {
      const liveHole = primaryTee?.holes?.[index];
      return {
        number: index + 1,
        par: liveHole?.par ?? DEFAULT_HOLE_PATTERN[index % DEFAULT_HOLE_PATTERN.length],
        yardage: liveHole?.yardage ?? null,
        postCount: courseDetail.holePostCounts[index % courseDetail.holePostCounts.length],
      };
    });
  }, [primaryTee, holesCount]);

  const mostPopularHole = useMemo(
    () => holes.reduce((max, hole) => (hole.postCount > max.postCount ? hole : max), holes[0]),
    [holes]
  );

  const filteredPosts = useMemo(() => {
    if (activeFilter === 'Pictures') return courseDetail.posts.filter((p) => p.type === 'photo');
    if (activeFilter === 'Videos') return courseDetail.posts.filter((p) => p.type === 'video');
    if (activeFilter === 'Swings') return courseDetail.posts.filter((p) => p.category === 'swing');
    return courseDetail.posts;
  }, [activeFilter]);

  const goToTab = (screen) => navigation.navigate('Tabs', { screen });

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.red} />
            <Text style={styles.headerBackText}>Map</Text>
          </TouchableOpacity>
          <View style={styles.headerLogoWrap} pointerEvents="none">
            <Text style={styles.headerLogo} numberOfLines={1}>
              SaveitGolf
            </Text>
          </View>
          <TouchableOpacity style={styles.headerRight} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="share-outline" size={21} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={[colors.navy, '#060e1a']} style={styles.hero}>
          <Text style={styles.courseName} numberOfLines={2}>
            {courseName ?? 'Course'}
          </Text>
          <Text style={styles.courseMeta}>
            {city ? `${city}, ${state}` : state} · {holesCount} Holes · Par {parTotal}
          </Text>
          <View style={[styles.publicBadge, !courseDetail.isPublic && styles.privateBadge]}>
            <Text style={styles.publicBadgeText}>
              {courseDetail.isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
        </LinearGradient>

        <View style={styles.statsBar}>
          <View style={styles.statHalf}>
            <Ionicons name="star" size={15} color={colors.gold} style={{ marginRight: 6 }} />
            <Text style={styles.statValue}>{courseDetail.rating}</Text>
            <Text style={styles.statLabel}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statHalf}>
            <Text style={styles.statValue}>{courseDetail.postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
              {activeTab === tab && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'All Posts' && (
          <View style={styles.tabContent}>
            <View style={styles.filterRow}>
              {postFilters.map((filter) => (
                <FilterPill
                  key={filter}
                  label={filter}
                  active={activeFilter === filter}
                  onPress={() => setActiveFilter(filter)}
                />
              ))}
            </View>
            <View style={styles.postsGrid}>
              {filteredPosts.map((post) => (
                <PostTile key={post.id} post={post} />
              ))}
            </View>
          </View>
        )}

        {activeTab === 'Hole by Hole' && (
          <View style={styles.tabContent}>
            <Text style={styles.helperText}>Tap any hole to see posts</Text>
            <View style={styles.holeGrid}>
              {holes.map((hole) => (
                <HoleCard
                  key={hole.number}
                  number={hole.number}
                  par={hole.par}
                  yardage={hole.yardage}
                  postCount={hole.postCount}
                  isMostPopular={hole.number === mostPopularHole.number}
                  onPress={() => setActiveTab('All Posts')}
                />
              ))}
            </View>
          </View>
        )}

        {activeTab === 'Scorecards' && (
          <View style={styles.tabContent}>
            {courseDetail.scorecards.map((entry) => (
              <ScorecardRow key={entry.id} entry={entry} />
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <BottomNavButton
          icon="newspaper-outline"
          iconFocused="newspaper"
          label="Feed"
          onPress={() => goToTab('Feed')}
        />
        <BottomNavButton
          icon="map-outline"
          iconFocused="map"
          label="Map"
          focused
          onPress={() => goToTab('Map')}
        />
        <TouchableOpacity
          style={styles.centerButtonWrapper}
          onPress={() => goToTab('Post')}
          activeOpacity={0.85}
        >
          <View style={styles.centerButton}>
            <Ionicons name="add" size={28} color={colors.white} />
          </View>
        </TouchableOpacity>
        <BottomNavButton
          icon="reader-outline"
          iconFocused="reader"
          label="Score"
          onPress={() => goToTab('Scorecard')}
        />
        <BottomNavButton
          icon="person-outline"
          iconFocused="person"
          label="Profile"
          onPress={() => goToTab('Profile')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBackText: {
    color: colors.red,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 2,
  },
  headerLogoWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 24,
    color: colors.white,
  },
  headerRight: {},
  scrollContent: {
    paddingBottom: 24,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  courseName: {
    color: colors.white,
    fontSize: 28,
    fontWeight: '800',
  },
  courseMeta: {
    color: colors.offWhite,
    fontSize: 13,
    marginTop: 6,
  },
  publicBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 12,
  },
  privateBadge: {
    borderColor: colors.red,
  },
  publicBadgeText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '700',
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingVertical: 16,
  },
  statHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.navyBorder,
  },
  statValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  statLabel: {
    color: colors.muted,
    fontSize: 12,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  tabTextActive: {
    color: colors.red,
  },
  tabIndicator: {
    marginTop: 8,
    height: 2,
    width: '70%',
    backgroundColor: colors.red,
    borderRadius: 1,
  },
  tabContent: {
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
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
    fontSize: 12,
  },
  pillTextActive: {
    color: colors.white,
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  postTile: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 10,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
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
  tileLikeRow: {
    position: 'absolute',
    left: 6,
    bottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tileLikeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 3,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 14,
  },
  holeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  holeCard: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: colors.navyBorder,
    marginBottom: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  holeCardPopular: {
    borderColor: colors.red,
    borderWidth: 1.5,
  },
  holeCardNumber: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  holeCardMeta: {
    color: colors.muted,
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  holeCardPostsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  holeCardPosts: {
    color: colors.red,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  scorecardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scorecardAvatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  scorecardInfo: {
    flex: 1,
  },
  scorecardName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  scorecardDate: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  scorecardScoreBlock: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scorecardScore: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    marginRight: 6,
  },
  scorecardDiff: {
    fontSize: 13,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: colors.navy,
    borderTopWidth: 1,
    borderTopColor: colors.navyBorder,
    height: 82,
    paddingTop: 8,
    paddingBottom: 20,
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 3,
  },
  navButtonLabelActive: {
    color: colors.red,
  },
  centerButtonWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    top: -14,
  },
  centerButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
});
