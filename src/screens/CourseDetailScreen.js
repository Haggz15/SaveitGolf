import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getCourseById } from '../services/golfCourseApi';
import { getCourseHoleStats, UNGROUPED_NINE } from '../services/posts';
import { getScorecardsForCourse } from '../services/scorecards';
import { getAverageRatingForCourse } from '../services/courseRankings';
import { getCoursePhoto } from '../data/coursePhotos';

const TABS = ['All Posts', 'Hole by Hole', 'Scorecards'];

// Typical 18-hole par distribution, used whenever live tee data hasn't
// loaded (or isn't available) so the Hole by Hole grid always has content.
const DEFAULT_HOLE_PATTERN = [4, 4, 3, 5, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 4, 3, 5];

function scoreDiffLabel(score, par) {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

function HoleCard({ number, par, yardage, postCount, isMostPopular, image, onPress }) {
  const content = (
    <>
      <Text style={styles.holeCardNumber}>{number}</Text>
      <Text style={styles.holeCardMeta}>
        Par {par}{yardage ? ` · ${yardage} yds` : ''}
      </Text>
      <View style={styles.holeCardPostsRow}>
        <Ionicons name="image-outline" size={12} color={colors.red} />
        <Text style={styles.holeCardPosts}>{postCount}</Text>
      </View>
    </>
  );

  if (image) {
    return (
      <TouchableOpacity
        style={[styles.holeCard, isMostPopular && styles.holeCardPopular]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Image source={image} style={styles.holeCardImage} resizeMode="cover" />
        <View style={styles.holeCardImageOverlay} />
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.holeCard, isMostPopular && styles.holeCardPopular]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {content}
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
  const { courseId, courseName, city, state, lat, lng, autoOpenAllPosts } = route.params ?? {};
  const insets = useSafeAreaInsets();
  const [tees, setTees] = useState(null);
  // 'All Posts' never renders inline — tapping it navigates straight to the
  // full-screen course feed (see handleSelectTab) — so it can't be the
  // resting tab.
  const [activeTab, setActiveTab] = useState('Hole by Hole');
  const [coursePosts, setCoursePosts] = useState([]);
  // Gates the stats bar / tab row / tab content behind a spinner — the
  // header and hero above render immediately from route params regardless,
  // so the screen never looks blank while this is in flight.
  const [postsLoading, setPostsLoading] = useState(true);
  const [scorecards, setScorecards] = useState([]);
  const [avgRating, setAvgRating] = useState(null);
  const [courseCoords, setCourseCoords] = useState({ lat: lat ?? null, lng: lng ?? null });

  // Arriving here from the feed's course-name-tap-on-map flow (see
  // useCourseMapData's courseAutoNavigate) — default straight into the All
  // Posts full-screen swipe feed rather than landing on Hole by Hole.
  // `replace` (not `navigate`) so this screen drops out of the stack: the
  // feed's own back button then returns straight to the Feed tab instead of
  // bouncing back through this intermediate screen.
  useEffect(() => {
    if (!autoOpenAllPosts) return;
    navigation.replace('CourseFeed', {
      filter: { courseId: courseId ?? null, courseName, hole: null, compositeName: null },
    });
    // Runs once on mount only — this screen is about to be replaced.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) return undefined;
    getCourseById(courseId)
      .then((course) => {
        if (cancelled) return;
        setTees(course.tees ?? null);
        setCourseCoords((prev) =>
          prev.lat != null && prev.lng != null ? prev : { lat: course.lat, lng: course.lng }
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    let cancelled = false;
    if (!courseId && !courseName) return undefined;

    setPostsLoading(true);
    getCourseHoleStats({ courseId, courseName })
      .then((stats) => {
        if (!cancelled) setCoursePosts(stats);
      })
      .catch((err) => console.error('Failed to load course posts:', err))
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    getScorecardsForCourse({ courseId, courseName })
      .then((rows) => {
        if (!cancelled) setScorecards(rows);
      })
      .catch((err) => console.error('Failed to load course scorecards:', err));

    getAverageRatingForCourse({ courseId, courseName })
      .then((rating) => {
        if (!cancelled) setAvgRating(rating);
      })
      .catch((err) => console.error('Failed to load course rating:', err));

    return () => {
      cancelled = true;
    };
  }, [courseId, courseName]);

  const primaryTee = tees?.male?.[0] ?? tees?.female?.[0] ?? null;
  const holesCount = primaryTee?.holes?.length ?? 18;
  const parTotal = primaryTee?.par_total ?? 72;

  const holes = useMemo(() => {
    return Array.from({ length: holesCount }, (_, index) => {
      const liveHole = primaryTee?.holes?.[index];
      const number = index + 1;
      return {
        number,
        par: liveHole?.par ?? DEFAULT_HOLE_PATTERN[index % DEFAULT_HOLE_PATTERN.length],
        yardage: liveHole?.yardage ?? null,
        postCount: coursePosts.filter((p) => p.hole === number).length,
        image: getCoursePhoto(courseName, number),
      };
    });
  }, [primaryTee, holesCount, courseName, coursePosts]);

  // Distinct composite nine names among this course's posts, in first-seen
  // order — drives the Hole by Hole tab's grouping (Step 5). Empty when no
  // post here has ever tagged a nine, which keeps that tab's classic
  // single-grid layout unchanged.
  const compositeNames = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    coursePosts.forEach((p) => {
      if (p.compositeName && !seen.has(p.compositeName)) {
        seen.add(p.compositeName);
        ordered.push(p.compositeName);
      }
    });
    return ordered;
  }, [coursePosts]);

  // A composite-named nine is always holes 1-9 regardless of which real
  // 9 of the course it maps to — same holes/par/image metadata as the
  // course's front nine, just re-scoped to whichever posts named `nine`.
  function nineHoles(nine) {
    return Array.from({ length: 9 }, (_, index) => {
      const liveHole = primaryTee?.holes?.[index];
      const number = index + 1;
      return {
        number,
        par: liveHole?.par ?? DEFAULT_HOLE_PATTERN[index % DEFAULT_HOLE_PATTERN.length],
        yardage: liveHole?.yardage ?? null,
        postCount: coursePosts.filter((p) => p.hole === number && p.compositeName === nine).length,
        image: getCoursePhoto(courseName, number),
      };
    });
  }

  // Posts logged at this course without ever toggling "multiple nines" —
  // shown as their own "Other Holes" section (full hole range) once at
  // least one composite-named nine exists, so they don't just disappear.
  const otherHoles = useMemo(
    () => holes.map((h) => ({ ...h, postCount: coursePosts.filter((p) => p.hole === h.number && !p.compositeName).length })),
    [holes, coursePosts]
  );

  // The single most-posted-to hole card across whichever grouping is
  // actually rendered below (plain grid, or nine-grouped + "Other Holes") —
  // highlighted in red (see HoleCard's isMostPopular). Keyed by
  // {number, nine} so the same hole number under two different nines is
  // judged independently rather than lumped together.
  const mostPopularEntry = useMemo(() => {
    let entries;
    if (compositeNames.length === 0) {
      entries = holes.map((h) => ({ number: h.number, nine: null, postCount: h.postCount }));
    } else {
      entries = [];
      compositeNames.forEach((nine) => {
        for (let number = 1; number <= 9; number++) {
          entries.push({
            number,
            nine,
            postCount: coursePosts.filter((p) => p.hole === number && p.compositeName === nine).length,
          });
        }
      });
      if (coursePosts.some((p) => !p.compositeName)) {
        holes.forEach((h) => {
          entries.push({
            number: h.number,
            nine: UNGROUPED_NINE,
            postCount: coursePosts.filter((p) => p.hole === h.number && !p.compositeName).length,
          });
        });
      }
    }
    if (entries.length === 0) return null;
    return entries.reduce((max, e) => (e.postCount > max.postCount ? e : max), entries[0]);
  }, [compositeNames, holes, coursePosts]);

  function isMostPopular(number, nine = null) {
    return !!mostPopularEntry && mostPopularEntry.number === number && mostPopularEntry.nine === nine;
  }

  // All Posts and Hole by Hole's individual hole cards both open the
  // full-screen swipe feed (reusing FeedScreen — see its `filter` prop and
  // RootNavigator's "CourseFeed" route) rather than rendering inline.
  // `compositeName` mirrors the three states getCourseFeedPosts expects:
  // omitted (no nine filter — classic non-composite course), a real nine
  // name, or UNGROUPED_NINE for the "Other Holes" bucket.
  function navigateToCourseFeed({ hole = null, compositeName = null } = {}) {
    navigation.navigate('CourseFeed', {
      filter: { courseId, courseName, hole, compositeName },
    });
  }

  function handleSelectTab(tab) {
    if (tab === 'All Posts') {
      navigateToCourseFeed();
      return;
    }
    setActiveTab(tab);
  }

  function handleSelectHole(number, nine = null) {
    navigateToCourseFeed({ hole: number, compositeName: nine });
  }

  const goToTab = (screen) => navigation.navigate('Tabs', { screen });

  function handleViewOnMap() {
    navigation.navigate('Tabs', {
      screen: 'Map',
      params: {
        focusCourse: {
          id: courseId ?? null,
          name: courseName,
          city: city ?? null,
          state: state ?? null,
          lat: courseCoords.lat,
          lng: courseCoords.lng,
        },
        timestamp: Date.now(),
      },
    });
  }

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
          <TouchableOpacity style={styles.viewOnMapButton} onPress={handleViewOnMap} activeOpacity={0.8}>
            <Ionicons name="location" size={12} color="#0d1f3c" />
            <Text style={styles.viewOnMapButtonText}>View on Map</Text>
          </TouchableOpacity>
          <Text style={styles.courseMeta}>
            {city ? `${city}, ${state}` : state} · {holesCount} Holes · Par {parTotal}
          </Text>
        </LinearGradient>

        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.red} size="large" />
          </View>
        ) : (
          <>
            <View style={styles.statsBar}>
              {avgRating != null && (
                <>
                  <View style={styles.statHalf}>
                    <Ionicons name="star" size={15} color={colors.gold} style={{ marginRight: 6 }} />
                    <Text style={styles.statValue}>{avgRating.toFixed(1)}</Text>
                    <Text style={styles.statLabel}>Rating</Text>
                  </View>
                  <View style={styles.statDivider} />
                </>
              )}
              <View style={styles.statHalf}>
                <Text style={styles.statValue}>{coursePosts.length}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
            </View>

            <View style={styles.tabRow}>
              {TABS.map((tab) => (
                <TouchableOpacity key={tab} style={styles.tabButton} onPress={() => handleSelectTab(tab)}>
                  <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
                  {activeTab === tab && <View style={styles.tabIndicator} />}
                </TouchableOpacity>
              ))}
            </View>

            {activeTab === 'Hole by Hole' && (
              <View style={styles.tabContent}>
                <Text style={styles.helperText}>Tap any hole to see posts</Text>
                {compositeNames.length === 0 ? (
                  <View style={styles.holeGrid}>
                    {holes.map((hole) => (
                      <HoleCard
                        key={hole.number}
                        number={hole.number}
                        par={hole.par}
                        yardage={hole.yardage}
                        postCount={hole.postCount}
                        isMostPopular={isMostPopular(hole.number)}
                        image={hole.image}
                        onPress={() => handleSelectHole(hole.number)}
                      />
                    ))}
                  </View>
                ) : (
                  <>
                    {compositeNames.map((nine) => (
                      <View key={nine} style={styles.nineSection}>
                        <Text style={styles.nineSectionHeader}>{nine}</Text>
                        <View style={styles.holeGrid}>
                          {nineHoles(nine).map((hole) => (
                            <HoleCard
                              key={hole.number}
                              number={hole.number}
                              par={hole.par}
                              yardage={hole.yardage}
                              postCount={hole.postCount}
                              isMostPopular={isMostPopular(hole.number, nine)}
                              image={hole.image}
                              onPress={() => handleSelectHole(hole.number, nine)}
                            />
                          ))}
                        </View>
                      </View>
                    ))}
                    {coursePosts.some((p) => !p.compositeName) && (
                      <View style={styles.nineSection}>
                        <Text style={styles.nineSectionHeader}>Other Holes</Text>
                        <View style={styles.holeGrid}>
                          {otherHoles.map((hole) => (
                            <HoleCard
                              key={hole.number}
                              number={hole.number}
                              par={hole.par}
                              yardage={hole.yardage}
                              postCount={hole.postCount}
                              isMostPopular={isMostPopular(hole.number, UNGROUPED_NINE)}
                              image={hole.image}
                              onPress={() => handleSelectHole(hole.number, UNGROUPED_NINE)}
                            />
                          ))}
                        </View>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {activeTab === 'Scorecards' && (
              <View style={styles.tabContent}>
                {scorecards.length === 0 ? (
                  <Text style={styles.helperText}>No scorecards logged at this course yet.</Text>
                ) : (
                  scorecards.map((entry) => <ScorecardRow key={entry.id} entry={entry} />)
                )}
              </View>
            )}
          </>
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
  viewOnMapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    backgroundColor: '#a8c0e0',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  viewOnMapButtonText: {
    color: '#0d1f3c',
    fontSize: 11,
    fontWeight: '700',
  },
  courseMeta: {
    color: colors.offWhite,
    fontSize: 13,
    marginTop: 6,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
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
  helperText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 14,
  },
  nineSection: {
    marginBottom: 18,
  },
  nineSectionHeader: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 14,
    color: colors.white,
    marginBottom: 10,
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
    overflow: 'hidden',
  },
  holeCardPopular: {
    borderColor: colors.red,
    borderWidth: 1.5,
  },
  holeCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  holeCardImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 26, 0.4)',
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
