import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getCourseById, getClubNines } from '../services/golfCourseApi';
import { findCourseIdByName, getCourseHoleStats, UNGROUPED_NINE, UNGROUPED_SUB_COURSE } from '../services/posts';
import { getScorecardsForCourse } from '../services/scorecards';
import { getCourseLocation, saveCourseLocation, CourseAlreadyPinnedError } from '../services/courseLocations';
import { reverseGeocodeCityState } from '../services/geocoding';
import { stateCenters } from '../data/courses';
import { US_INITIAL_REGION } from '../hooks/useCourseMapData';
import { useAuth } from '../context/AuthContext';
import { PinPreviewMap } from '../components/map/CoursePinMaps';
import CoursePinPlacementModal from '../components/map/CoursePinPlacementModal';

const TABS = ['All Posts', 'Hole by Hole', 'Scorecards'];

const DEFAULT_HOLES_COUNT = 18;

// A hole's par as entered by users on their posts (PostScreen's Par field) —
// the most common value wins, so one typo doesn't override everyone else.
// Null until someone has entered one; used only when golfcourseapi.com has
// no tee data for the course (e.g. a hand-typed course with no API match).
function userEnteredPar(posts, holeNumber) {
  const counts = new Map();
  for (const p of posts) {
    if (p.hole === holeNumber && p.par > 0) counts.set(p.par, (counts.get(p.par) ?? 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [par, count] of counts) {
    if (count > bestCount) {
      best = par;
      bestCount = count;
    }
  }
  return best;
}

function scoreDiffLabel(score, par) {
  const diff = score - par;
  if (diff === 0) return 'E';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

// Hole number, par/yardage, and post count only — no image previews. A hole
// with no known par (no API tee data and no user-entered par) shows none. Every
// card renders identically sized (see styles.holeCard's fixed width +
// aspectRatio) regardless of whether golfcourseapi.com happened to return
// tee data for this hole; only the red border (isMostPopular) varies.
function HoleCard({ number, par, yardage, postCount, isMostPopular, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.holeCard, isMostPopular && styles.holeCardPopular]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.holeCardNumber}>{number}</Text>
      {(par != null || yardage) && (
        <Text style={styles.holeCardMeta}>
          {[par != null ? `Par ${par}` : null, yardage ? `${yardage} yds` : null].filter(Boolean).join(' · ')}
        </Text>
      )}
      <View style={styles.holeCardPostsRow}>
        <Ionicons name="image-outline" size={12} color={colors.red} />
        <Text style={styles.holeCardPosts}>{postCount}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Renders the classic single-grid layout, or nines grouped as their own
// sections plus an "Other Holes" catch-all, for whatever subset of a
// course's posts it's given — used directly for a single-course page, and
// once per named sub-course (see CourseDetailScreen's subCourseNames, Fix 6)
// for a golf complex with multiple distinct courses under one name.
function HoleByHoleGrid({ posts, holeShells, onSelectHole }) {
  const compositeNames = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    posts.forEach((p) => {
      if (p.compositeName && !seen.has(p.compositeName)) {
        seen.add(p.compositeName);
        ordered.push(p.compositeName);
      }
    });
    return ordered;
  }, [posts]);

  const holes = useMemo(
    () => holeShells.map((h) => ({ ...h, postCount: posts.filter((p) => p.hole === h.number).length })),
    [holeShells, posts]
  );

  // A composite-named nine is always holes 1-9 regardless of which real 9 of
  // the course it maps to — same holes/par metadata as the course's front
  // nine, just re-scoped to whichever posts named `nine`.
  function nineHoles(nine) {
    return holeShells.slice(0, 9).map((h) => ({
      ...h,
      postCount: posts.filter((p) => p.hole === h.number && p.compositeName === nine).length,
    }));
  }

  // Posts logged here without ever toggling "multiple nines" — shown as
  // their own "Other Holes" section (full hole range) once at least one
  // composite-named nine exists, so they don't just disappear.
  const otherHoles = useMemo(
    () => holes.map((h) => ({ ...h, postCount: posts.filter((p) => p.hole === h.number && !p.compositeName).length })),
    [holes, posts]
  );

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
            postCount: posts.filter((p) => p.hole === number && p.compositeName === nine).length,
          });
        }
      });
      if (posts.some((p) => !p.compositeName)) {
        holes.forEach((h) => {
          entries.push({
            number: h.number,
            nine: UNGROUPED_NINE,
            postCount: posts.filter((p) => p.hole === h.number && !p.compositeName).length,
          });
        });
      }
    }
    if (entries.length === 0) return null;
    return entries.reduce((max, e) => (e.postCount > max.postCount ? e : max), entries[0]);
  }, [compositeNames, holes, posts]);

  function isMostPopular(number, nine = null) {
    return !!mostPopularEntry && mostPopularEntry.number === number && mostPopularEntry.nine === nine;
  }

  if (compositeNames.length === 0) {
    return (
      <View style={styles.holeGrid}>
        {holes.map((hole) => (
          <HoleCard
            key={hole.number}
            number={hole.number}
            par={hole.par}
            yardage={hole.yardage}
            postCount={hole.postCount}
            isMostPopular={isMostPopular(hole.number)}
            onPress={() => onSelectHole(hole.number)}
          />
        ))}
      </View>
    );
  }

  return (
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
                onPress={() => onSelectHole(hole.number, nine)}
              />
            ))}
          </View>
        </View>
      ))}
      {posts.some((p) => !p.compositeName) && (
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
                onPress={() => onSelectHole(hole.number, UNGROUPED_NINE)}
              />
            ))}
          </View>
        </View>
      )}
    </>
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
  const { courseId: paramCourseId, courseName, city, state, lat, lng, autoOpenAllPosts } = route.params ?? {};
  // Arriving with only a name (a hand-typed entry for a course others logged
  // via search) — adopt the real id if posts agree on exactly one, so this
  // shows the API course rather than the name-only duplicate. See
  // findCourseIdByName.
  const [courseId, setCourseId] = useState(paramCourseId ?? null);
  useEffect(() => {
    setCourseId(paramCourseId ?? null);
    if (paramCourseId || !courseName) return undefined;
    let cancelled = false;
    findCourseIdByName(courseName, state)
      .then((id) => {
        if (!cancelled && id) setCourseId(id);
      })
      .catch((err) => console.error('Failed to resolve course id by name:', err));
    return () => {
      cancelled = true;
    };
  }, [paramCourseId, courseName, state]);
  const insets = useSafeAreaInsets();
  const { user, profile } = useAuth();
  const [tees, setTees] = useState(null);
  // Named nines at this course's club, from golfcourseapi.com (see
  // getClubNines) — empty for an ordinary course. `layout` is null for the
  // standard 18, otherwise the selected nine's name.
  const [clubNines, setClubNines] = useState([]);
  const [layout, setLayout] = useState(null);
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
  const [courseCoords, setCourseCoords] = useState({ lat: lat ?? null, lng: lng ?? null });
  // A hand-typed course's shared pin (see courseLocations.js) — null until
  // someone places one. pinLoaded gates the Place/Move pin button so it
  // doesn't flash "Place pin" before we know whether a pin exists.
  const [coursePin, setCoursePin] = useState(null);
  const [pinLoaded, setPinLoaded] = useState(false);
  const [placingPin, setPlacingPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  // Coordinates arriving via new route params (e.g. back from saving a
  // dropped pin) win over whatever this screen already resolved.
  useEffect(() => {
    if (lat != null && lng != null) setCourseCoords({ lat, lng });
  }, [lat, lng]);

  // A hand-typed course has no golfcourseapi.com record to take a location
  // from — use the pin someone dropped for it, if any.
  useEffect(() => {
    if (courseId || !courseName) return undefined;
    let cancelled = false;
    setPinLoaded(false);
    getCourseLocation(courseName)
      .then((pin) => {
        if (cancelled) return;
        setCoursePin(pin);
        // The shared pin is the source of truth for a hand-typed course.
        if (pin) setCourseCoords({ lat: pin.lat, lng: pin.lng });
      })
      .catch((err) => console.error('Failed to load course pin:', err))
      .finally(() => {
        if (!cancelled) setPinLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId, courseName]);

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
        return getClubNines(course).then((nines) => {
          if (!cancelled) setClubNines(nines);
        });
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

    return () => {
      cancelled = true;
    };
  }, [courseId, courseName]);

  const primaryTee = tees?.male?.[0] ?? tees?.female?.[0] ?? null;
  const holesCount = primaryTee?.holes?.length ?? DEFAULT_HOLES_COUNT;

  // Hole number/par/yardage shells — HoleByHoleGrid layers postCount onto
  // these per whichever subset of coursePosts it's given (see subCourseNames
  // below). Par comes from golfcourseapi.com tee data when there is any,
  // otherwise from what users entered on their posts, otherwise it's left
  // null rather than guessed.
  const holeShells = useMemo(() => {
    return Array.from({ length: holesCount }, (_, index) => {
      const liveHole = primaryTee?.holes?.[index];
      return {
        number: index + 1,
        par: liveHole?.par ?? userEnteredPar(coursePosts, index + 1),
        yardage: liveHole?.yardage ?? null,
      };
    });
  }, [primaryTee, holesCount, coursePosts]);

  // Only shown once every hole's par is known — a partial sum would read as
  // a real (and wrong) course par.
  const parTotal =
    primaryTee?.par_total ??
    (holeShells.every((h) => h.par != null) ? holeShells.reduce((sum, h) => sum + h.par, 0) : null);

  const displayCity = city ?? coursePin?.city;
  const displayState = state ?? coursePin?.state;
  // A placed pin's reverse-geocoded "City, ST" wins for a hand-typed course —
  // it's where the course actually is, not whatever the poster typed.
  const locationLabel = coursePin?.locationDisplay || [displayCity, displayState].filter(Boolean).join(', ');
  const hasPin = courseCoords.lat != null && courseCoords.lng != null;

  // Hand-typed course (no golfcourseapi.com id): its location comes only
  // from a user-placed pin. The first signed-in user to place one owns it;
  // after that only they can move it.
  const isCustomCourse = !courseId;
  const pinOwner = coursePin?.pinPlacedBy ?? null;
  const canPlacePin = isCustomCourse && pinLoaded && !!user && (!pinOwner || pinOwner === user.id);
  const pinCenter = coursePin ? { lat: coursePin.lat, lng: coursePin.lng } : null;
  // No pin yet: frame the course's state, else the viewer's home state,
  // else the whole US.
  const fallbackState = stateCenters[displayState] ?? stateCenters[profile?.home_state];
  const mapCenter =
    pinCenter ??
    (fallbackState
      ? { lat: fallbackState.lat, lng: fallbackState.lng }
      : { lat: US_INITIAL_REGION.latitude, lng: US_INITIAL_REGION.longitude });

  // Distinct sub-course names among this course's posts, in first-seen
  // order — an outer grouping layer above HoleByHoleGrid's own nine
  // grouping, for a golf complex with multiple distinct courses under one
  // name (e.g. PGA West's Stadium/Nicklaus/Palmer courses — Fix 6). Empty
  // when no post here has ever tagged one, which keeps the classic
  // single-course layout unchanged.
  const subCourseNames = useMemo(() => {
    const seen = new Set();
    const ordered = [];
    coursePosts.forEach((p) => {
      if (p.subCourseName && !seen.has(p.subCourseName)) {
        seen.add(p.subCourseName);
        ordered.push(p.subCourseName);
      }
    });
    return ordered;
  }, [coursePosts]);

  // A course with named nines gets a layout selector instead of grouping its
  // grid under nine headers: "18 Holes" (posts that never tagged a nine), or
  // one nine's holes 1-9. Posts tag a nine as either a composite nine or a
  // sub-course, so both count. A nine posts name that the API doesn't know
  // still gets an option so its posts stay reachable, with user-entered pars.
  //
  // A course the API doesn't list nines for (usually a 27+ hole club it only
  // knows as one 18) gets the same selector once a post tags a nine via
  // "This course has multiple nines" — only compositeName counts there, since
  // a sub-course is a whole course, not a nine. With no tagged nines, an
  // ordinary 18 keeps the classic layout below.
  const ninesFromApi = clubNines.length > 0;
  const nineTag = (p) => (ninesFromApi ? p.compositeName || p.subCourseName || '' : p.compositeName || '').toLowerCase();

  const layoutOptions = useMemo(() => {
    const options = clubNines.map((nine) => ({ name: nine.name, apiHoles: nine.holes }));
    const known = new Set(options.map((o) => o.name.toLowerCase()));
    const tagged = [];
    coursePosts.forEach((p) => {
      const tag = ninesFromApi ? p.compositeName || p.subCourseName : p.compositeName;
      if (tag && !known.has(tag.toLowerCase())) {
        known.add(tag.toLowerCase());
        tagged.push({ name: tag, apiHoles: null });
      }
    });
    if (!ninesFromApi) tagged.sort((a, b) => a.name.localeCompare(b.name));
    return [...options, ...tagged];
  }, [clubNines, coursePosts, ninesFromApi]);

  const selectedNine = layoutOptions.find((o) => o.name === layout) ?? null;

  const layoutGrid = useMemo(() => {
    if (layoutOptions.length === 0) return null;
    if (!selectedNine) {
      return { posts: coursePosts.filter((p) => !nineTag(p)), holeShells };
    }
    const key = selectedNine.name.toLowerCase();
    // compositeName cleared so HoleByHoleGrid renders one flat grid.
    const posts = coursePosts.filter((p) => nineTag(p) === key).map((p) => ({ ...p, compositeName: null }));
    const shells = Array.from({ length: 9 }, (_, index) => {
      const apiHole = selectedNine.apiHoles?.[index];
      return {
        number: index + 1,
        par: apiHole?.par ?? userEnteredPar(posts, index + 1),
        yardage: apiHole?.yardage ?? null,
      };
    });
    return { posts, holeShells: shells };
  }, [layoutOptions, selectedNine, coursePosts, holeShells, ninesFromApi]);

  function handleSelectLayoutHole(number) {
    if (selectedNine) {
      navigateToCourseFeed({ hole: number, nineName: selectedNine.name });
    } else {
      // Tag-derived nines leave sub-course posts in the 18-hole view, so the
      // feed mustn't filter them out either.
      navigateToCourseFeed({
        hole: number,
        compositeName: UNGROUPED_NINE,
        subCourseName: ninesFromApi ? UNGROUPED_SUB_COURSE : null,
      });
    }
  }

  // All Posts and Hole by Hole's individual hole cards both open the
  // full-screen swipe feed (reusing FeedScreen — see its `filter` prop and
  // RootNavigator's "CourseFeed" route) rather than rendering inline.
  // `compositeName`/`subCourseName` mirror the states getCourseFeedPosts
  // expects: omitted (no filter), a real name, or their UNGROUPED_* sentinel.
  // `nineName` is one of the layout selector's nines.
  function navigateToCourseFeed({ hole = null, compositeName = null, subCourseName = null, nineName = null } = {}) {
    navigation.navigate('CourseFeed', {
      filter: { courseId, courseName, hole, compositeName, subCourseName, nineName },
    });
  }

  function handleSelectTab(tab) {
    if (tab === 'All Posts') {
      navigateToCourseFeed();
      return;
    }
    setActiveTab(tab);
  }

  function handleSelectHole(number, nine = null, subCourse = null) {
    navigateToCourseFeed({ hole: number, compositeName: nine, subCourseName: subCourse });
  }

  const goToTab = (screen) => navigation.navigate('Tabs', { screen });

  // Hand-typed courses have no id (even after findCourseIdByName), so they
  // share the message alone rather than a dead /course/undefined link.
  // Share's `url` is iOS-only — Android only sends `message`, so the link
  // rides along in the text there.
  async function handleShareCourse() {
    const message = `Check out ${courseName} on SaveitGolf!`;
    const url = courseId ? `https://saveitgolf.com/course/${courseId}` : null;
    try {
      await Share.share(
        Platform.OS === 'ios' || !url ? { message, ...(url && { url }) } : { message: `${message} ${url}` }
      );
    } catch (e) {
      console.log(e);
    }
  }

  function handleViewOnMap() {
    navigation.navigate('Tabs', {
      screen: 'Map',
      params: {
        focusCourse: {
          id: courseId ?? null,
          name: courseName,
          city: displayCity ?? null,
          state: displayState ?? null,
          lat: courseCoords.lat,
          lng: courseCoords.lng,
        },
        timestamp: Date.now(),
      },
    });
  }

  async function handleSavePin(center) {
    if (!center || !user || savingPin) return;
    setSavingPin(true);
    // City/state are a nice-to-have for the header — a reverse-geocoding
    // failure never blocks saving the pin itself.
    const place = await reverseGeocodeCityState(center.lat, center.lng).catch(() => null);
    try {
      const saved = await saveCourseLocation(user.id, {
        courseName,
        lat: center.lat,
        lng: center.lng,
        city: place?.city,
        state: place?.state,
      });
      setCoursePin(saved);
      setCourseCoords({ lat: saved.lat, lng: saved.lng });
      setPlacingPin(false);
    } catch (err) {
      if (err instanceof CourseAlreadyPinnedError) {
        // Someone beat us to it — show their pin instead.
        setPlacingPin(false);
        getCourseLocation(courseName)
          .then((pin) => {
            setCoursePin(pin);
            if (pin) setCourseCoords({ lat: pin.lat, lng: pin.lng });
          })
          .catch(() => {});
        Alert.alert('Already pinned', err.message);
      } else {
        console.error('Failed to save course pin:', err);
        Alert.alert("Couldn't save location", 'Please try again.');
      }
    } finally {
      setSavingPin(false);
    }
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
          <View style={styles.headerLogoWrap} pointerEvents="box-none">
            <TouchableOpacity
              onPress={() => navigation.navigate('Tabs', { screen: 'Following' })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.headerLogo} numberOfLines={1}>
                SaveitGolf
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.headerRight}
            onPress={handleShareCourse}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="share-outline" size={21} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient colors={[colors.navy, '#060e1a']} style={styles.hero}>
          <Text style={styles.courseName} numberOfLines={2}>
            {courseName ?? 'Course'}
          </Text>
          {hasPin || locationLabel ? (
            <TouchableOpacity style={styles.viewOnMapButton} onPress={handleViewOnMap} activeOpacity={0.8}>
              <Ionicons name="location" size={12} color="#0d1f3c" />
              <Text style={styles.viewOnMapButtonText}>View on Map</Text>
            </TouchableOpacity>
          ) : (
            // A hand-typed course nobody has located yet — see the pin map below.
            <View style={styles.locationPlaceholder}>
              <Text style={styles.locationPlaceholderText}>Location not set yet</Text>
            </View>
          )}
          <Text style={styles.courseMeta}>
            {[locationLabel || null, `${holesCount} Holes`, parTotal != null ? `Par ${parTotal}` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </LinearGradient>

        {isCustomCourse && (
          <View style={styles.pinSection}>
            <View style={styles.pinMapFrame}>
              <PinPreviewMap center={mapCenter} pin={pinCenter} />
            </View>
            {canPlacePin && (
              <TouchableOpacity style={styles.pinButton} onPress={() => setPlacingPin(true)} activeOpacity={0.85}>
                <Ionicons name="pin" size={14} color={colors.white} />
                <Text style={styles.pinButtonText}>{coursePin ? 'Move pin' : 'Place pin'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {postsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={colors.red} size="large" />
          </View>
        ) : (
          <>
            <View style={styles.statsBar}>
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
                {layoutGrid && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.layoutSelector}
                  >
                    {[null, ...layoutOptions.map((o) => o.name)].map((name) => {
                      const active = (selectedNine?.name ?? null) === name;
                      return (
                        <TouchableOpacity
                          key={name ?? '18'}
                          style={[styles.layoutPill, active && styles.layoutPillActive]}
                          onPress={() => setLayout(name)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.layoutPillText, active && styles.layoutPillTextActive]}>
                            {name ? `${name} (9)` : '18 Holes'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
                <Text style={styles.helperText}>Tap any hole to see posts</Text>
                {layoutGrid ? (
                  <HoleByHoleGrid
                    key={selectedNine?.name ?? '18'}
                    posts={layoutGrid.posts}
                    holeShells={layoutGrid.holeShells}
                    onSelectHole={handleSelectLayoutHole}
                  />
                ) : subCourseNames.length === 0 ? (
                  <HoleByHoleGrid
                    posts={coursePosts}
                    holeShells={holeShells}
                    onSelectHole={handleSelectHole}
                  />
                ) : (
                  <>
                    {subCourseNames.map((subCourse) => (
                      <View key={subCourse} style={styles.subCourseSection}>
                        <Text style={styles.subCourseSectionHeader}>{subCourse}</Text>
                        <HoleByHoleGrid
                          posts={coursePosts.filter((p) => p.subCourseName === subCourse)}
                          holeShells={holeShells}
                          onSelectHole={(number, nine) => handleSelectHole(number, nine, subCourse)}
                        />
                      </View>
                    ))}
                    {coursePosts.some((p) => !p.subCourseName) && (
                      <View style={styles.subCourseSection}>
                        <Text style={styles.subCourseSectionHeader}>Other Courses</Text>
                        <HoleByHoleGrid
                          posts={coursePosts.filter((p) => !p.subCourseName)}
                          holeShells={holeShells}
                          onSelectHole={(number, nine) => handleSelectHole(number, nine, UNGROUPED_SUB_COURSE)}
                        />
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

      {isCustomCourse && (
        <CoursePinPlacementModal
          visible={placingPin}
          courseName={courseName}
          initialCenter={mapCenter}
          zoomedIn={!!pinCenter}
          saving={savingPin}
          onCancel={() => setPlacingPin(false)}
          onSave={handleSavePin}
        />
      )}

      <View style={[styles.bottomNav, { height: 62 + Math.max(insets.bottom, 12), paddingBottom: Math.max(insets.bottom, 12) }]}>
        <BottomNavButton
          icon="people-outline"
          iconFocused="people"
          label="Following"
          onPress={() => goToTab('Following')}
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
    // Room for the script "f" swash — see Header's logo style.
    paddingRight: 8,
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
  locationPlaceholder: {
    marginTop: 8,
  },
  locationPlaceholderText: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
  },
  pinSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  pinMapFrame: {
    height: 180,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  pinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.red,
  },
  pinButtonText: {
    color: colors.white,
    fontSize: 14,
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
  layoutSelector: {
    gap: 8,
    marginBottom: 14,
  },
  layoutPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    backgroundColor: colors.navyCard,
  },
  layoutPillActive: {
    borderColor: colors.red,
    backgroundColor: colors.red,
  },
  layoutPillText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
  },
  layoutPillTextActive: {
    color: colors.white,
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
  subCourseSection: {
    marginBottom: 24,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  subCourseSectionHeader: {
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    color: colors.red,
    marginBottom: 12,
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
