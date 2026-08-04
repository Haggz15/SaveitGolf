import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { stateCenters, allStateAbbreviations } from '../data/courses';
import { getCourseById, searchCourses, RateLimitError } from '../services/golfCourseApi';
import { getCachedStateCourses, persistStateCourses } from '../services/stateCourses';
import { getMyCourses } from '../services/myCourses';

// Zoomed-out default view — the whole contiguous US, so the map opens on the
// Level 1 "50 state pins, no course data" view described in the map's
// zoom-based loading system (see ZOOM_LEVEL below).
export const US_INITIAL_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 32,
  longitudeDelta: 55,
};

// How far out the map is allowed to zoom via the in-app zoom-out control.
export const MAX_MAP_DELTA = 45;

export const USER_LOCATION_FOCUS_DELTA = 2;

// How tight the map zooms in when a search result, feed course, or state pin
// is selected/focused.
export const SEARCH_FOCUS_DELTA = 0.02;
export const STATE_FOCUS_DELTA = 4;
const SEARCH_DEBOUNCE_MS = 400;

export const MAP_FILTERS = { ALL: 'all', PLAYED: 'played' };

// Three zoom tiers drive what gets fetched and rendered:
//   COUNTRY — full US view: 50 one-per-state pins, no individual course data.
//   STATE   — zoomed into one state: every course in that state, fetched (or
//             read from cache) via a single search_query=<state name> call.
//   REGION  — zoomed into a city: same state's courses, culled to what's
//             actually inside the current viewport.
export const ZOOM_LEVEL = { COUNTRY: 'country', STATE: 'state', REGION: 'region' };
const COUNTRY_ZOOM_DELTA = 15;
const STATE_ZOOM_DELTA = 1.2;

// How long the "N courses in <State>" banner stays up after a state finishes loading.
const COUNT_BANNER_MS = 3500;

function getZoomLevel(region) {
  if (region.latitudeDelta >= COUNTRY_ZOOM_DELTA) return ZOOM_LEVEL.COUNTRY;
  if (region.latitudeDelta >= STATE_ZOOM_DELTA) return ZOOM_LEVEL.STATE;
  return ZOOM_LEVEL.REGION;
}

// The app has no state-boundary polygons, so "which state is the map
// centered on" is approximated as the nearest state centroid to the
// viewport center — accurate enough once the viewport is state-sized or smaller.
function nearestState(region) {
  let best = null;
  let bestDist = Infinity;
  for (const abbr of allStateAbbreviations) {
    const c = stateCenters[abbr];
    const d = Math.hypot(c.lat - region.latitude, c.lng - region.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = abbr;
    }
  }
  return best;
}

function coursesInBounds(courses, region) {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;
  return courses.filter(
    (c) => c.lat != null && c.lat >= latMin && c.lat <= latMax && c.lng >= lngMin && c.lng <= lngMax
  );
}

// Platform-agnostic course map state/logic (zoom-based state loading, course
// selection, search, and the played-courses filter). Both MapScreen.js
// (react-native-maps) and MapScreen.web.js (react-leaflet) drive this same
// hook and only differ in how they render the map surface and markers.
export function useCourseMapData({ navigation, routeFocusCourse, routeTimestamp, userId } = {}) {
  const [region, setRegionState] = useState(US_INITIAL_REGION);
  // Set when the hook wants the map to jump somewhere outside of user
  // panning (initial location fix, a state pin tap, or a feed course focus).
  // Each platform watches this and drives its own map's recenter API off of it.
  const [focusRegion, setFocusRegion] = useState(null);
  // abbr -> { courses, loading }
  const [stateCourseCache, setStateCourseCache] = useState({});
  const [countBanner, setCountBanner] = useState(null); // { abbr, count } | null
  const countBannerTimeoutRef = useRef(null);
  const stateFetchInFlight = useRef(new Set());
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null); // { holes, loading, error }
  const [filter, setFilter] = useState(MAP_FILTERS.ALL);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  // "Courses I've Played" pulls from the user's own my_courses table rather
  // than the zoom-level course cache — it's a distinct, user-curated list
  // that may include courses never surfaced by state search, and it
  // overrides the zoom-level behavior entirely per the map spec.
  const [myCoursesList, setMyCoursesList] = useState([]);
  const [myCoursesLoading, setMyCoursesLoading] = useState(false);
  const [myCoursesLoaded, setMyCoursesLoaded] = useState(false);

  useEffect(() => {
    if (filter !== MAP_FILTERS.PLAYED) return;
    if (!userId) {
      setMyCoursesList([]);
      setMyCoursesLoaded(true);
      return;
    }
    let cancelled = false;
    setMyCoursesLoading(true);
    getMyCourses(userId)
      .then((rows) => {
        if (cancelled) return;
        setMyCoursesList(
          rows
            .filter((r) => r.latitude != null && r.longitude != null)
            .map((r) => ({
              id: r.courseId || r.id,
              name: r.courseName,
              city: r.city,
              state: r.state,
              lat: r.latitude,
              lng: r.longitude,
            }))
        );
      })
      .catch((err) => {
        console.error('[useCourseMapData] failed to load my courses:', err.message);
        if (!cancelled) setMyCoursesList([]);
      })
      .finally(() => {
        if (!cancelled) {
          setMyCoursesLoading(false);
          setMyCoursesLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [filter, userId]);

  const zoomLevel = useMemo(() => getZoomLevel(region), [region]);
  const currentStateAbbr = useMemo(
    () => (zoomLevel === ZOOM_LEVEL.COUNTRY ? null : nearestState(region)),
    [zoomLevel, region]
  );
  const currentStateLoading = currentStateAbbr ? !!stateCourseCache[currentStateAbbr]?.loading : false;

  const stateMarkers = useMemo(
    () =>
      allStateAbbreviations.map((abbr) => ({
        abbr,
        name: stateCenters[abbr].name,
        lat: stateCenters[abbr].lat,
        lng: stateCenters[abbr].lng,
      })),
    []
  );

  const announceCountBanner = useCallback((abbr, courseList) => {
    if (countBannerTimeoutRef.current) clearTimeout(countBannerTimeoutRef.current);
    setCountBanner({ abbr, name: stateCenters[abbr].name, count: courseList.length });
    countBannerTimeoutRef.current = setTimeout(() => setCountBanner(null), COUNT_BANNER_MS);
  }, []);

  // Loads every course in a state (cache -> AsyncStorage -> live search),
  // storing the result in stateCourseCache so re-entering the state later
  // (this session or a future one) is instant. Returns the course list, or
  // null if another call is already loading this state or the fetch failed.
  const ensureStateCoursesLoaded = useCallback(
    async (abbr) => {
      if (!abbr) return null;
      const existing = stateCourseCache[abbr];
      if (existing && !existing.loading) return existing.courses;
      if (stateFetchInFlight.current.has(abbr)) return null;

      stateFetchInFlight.current.add(abbr);
      setStateCourseCache((prev) => ({ ...prev, [abbr]: { courses: prev[abbr]?.courses ?? [], loading: true } }));

      try {
        const cached = await getCachedStateCourses(abbr);
        if (cached) {
          console.log(`[useCourseMapData] ${abbr}: ${cached.length} course(s) from cache`);
          setStateCourseCache((prev) => ({ ...prev, [abbr]: { courses: cached, loading: false } }));
          return cached;
        }

        const stateName = stateCenters[abbr].name;
        const results = await searchCourses(stateName);
        const matches = results.filter((c) => c.state?.toUpperCase() === abbr);
        console.log(`[useCourseMapData] ${abbr}: ${matches.length} of ${results.length} search("${stateName}") result(s) matched`);

        await persistStateCourses(abbr, matches);
        setStateCourseCache((prev) => ({ ...prev, [abbr]: { courses: matches, loading: false } }));
        setQuotaExceeded(false);
        return matches;
      } catch (err) {
        if (err instanceof RateLimitError) {
          console.warn(`[useCourseMapData] rate limited loading ${abbr}`);
          setQuotaExceeded(true);
        } else {
          console.error(`[useCourseMapData] failed to load courses for ${abbr}:`, err.message);
        }
        // Drop the in-progress entry entirely (rather than leaving it
        // loading:false with no courses) so the state is retried on the next
        // visit instead of being permanently treated as "loaded, empty".
        setStateCourseCache((prev) => {
          const next = { ...prev };
          delete next[abbr];
          return next;
        });
        return null;
      } finally {
        stateFetchInFlight.current.delete(abbr);
      }
    },
    [stateCourseCache]
  );

  const loadStateAndAnnounce = useCallback(
    async (abbr) => {
      const result = await ensureStateCoursesLoaded(abbr);
      if (result) announceCountBanner(abbr, result);
    },
    [ensureStateCoursesLoaded, announceCountBanner]
  );

  // State detection: whenever the viewport settles on a new state at
  // STATE or REGION zoom, load that state's courses (instantly if cached).
  useEffect(() => {
    if (filter === MAP_FILTERS.PLAYED) return;
    if (zoomLevel === ZOOM_LEVEL.COUNTRY || !currentStateAbbr) return;
    loadStateAndAnnounce(currentStateAbbr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoomLevel, currentStateAbbr, filter]);

  // Try to recenter on the user's location (state-zoom) so the app opens
  // showing their own area's courses when permission is granted; otherwise
  // it stays on the Level 1 full-US view.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationDenied(true);
        return;
      }
      try {
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const { latitude, longitude } = position.coords;
        const nextRegion = {
          latitude,
          longitude,
          latitudeDelta: USER_LOCATION_FOCUS_DELTA,
          longitudeDelta: USER_LOCATION_FOCUS_DELTA,
        };
        setRegionState(nextRegion);
        setFocusRegion({ ...nextRegion, key: `user-${Date.now()}` });
        setUserLocation({ latitude, longitude });
      } catch (err) {
        console.warn('Could not get current location:', err.message);
      }
    })();
  }, []);

  // Feed's per-post state badge navigates here with a course to focus on
  // (see FeedScreen.handleStatePress). If the post didn't have stored
  // coordinates, look the course up by name via the Golf Course API before
  // dropping the pin.
  useEffect(() => {
    if (!routeFocusCourse) return;
    let cancelled = false;

    (async () => {
      let course = routeFocusCourse;
      if (course.lat == null || course.lng == null) {
        try {
          const results = await searchCourses(course.name);
          const match =
            results.find(
              (c) => c.state && course.state && c.state.toUpperCase() === course.state.toUpperCase() && c.lat != null
            ) ?? results.find((c) => c.lat != null && c.lng != null);
          if (match) {
            course = { ...match, id: course.id ?? match.id, name: course.name || match.name };
          }
        } catch (err) {
          console.error(`[useCourseMapData] course lookup failed for "${course.name}":`, err.message);
        }
      }
      if (cancelled || course.lat == null || course.lng == null) return;

      const nextRegion = {
        latitude: course.lat,
        longitude: course.lng,
        latitudeDelta: SEARCH_FOCUS_DELTA,
        longitudeDelta: SEARCH_FOCUS_DELTA,
      };
      setRegionState(nextRegion);
      setFocusRegion({ ...nextRegion, key: `feed-${course.id ?? course.name}-${routeTimestamp}` });
      handleSelectCourse(course);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFocusCourse, routeTimestamp]);

  const currentStateCourses = useMemo(
    () => (currentStateAbbr ? stateCourseCache[currentStateAbbr]?.courses ?? [] : []),
    [currentStateAbbr, stateCourseCache]
  );

  const visibleCourses = useMemo(() => {
    let base;
    if (filter === MAP_FILTERS.PLAYED) {
      base = myCoursesList;
    } else if (zoomLevel === ZOOM_LEVEL.COUNTRY) {
      base = [];
    } else if (zoomLevel === ZOOM_LEVEL.STATE) {
      base = currentStateCourses;
    } else {
      base = coursesInBounds(currentStateCourses, region);
    }

    // Always keep the selected/focused course pinned and visible — a search
    // result or a course opened from the feed may sit outside the currently
    // loaded state's course list or the culled viewport.
    if (selectedCourse && filter !== MAP_FILTERS.PLAYED && !base.some((c) => c.id === selectedCourse.id)) {
      base = [...base, selectedCourse];
    }
    return base;
  }, [filter, myCoursesList, zoomLevel, currentStateCourses, region, selectedCourse]);

  const handleSelectStateMarker = useCallback(
    (abbr) => {
      const center = stateCenters[abbr];
      if (!center) return;
      const nextRegion = {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: STATE_FOCUS_DELTA,
        longitudeDelta: STATE_FOCUS_DELTA,
      };
      setRegionState(nextRegion);
      setFocusRegion({ ...nextRegion, key: `state-${abbr}-${Date.now()}` });
      loadStateAndAnnounce(abbr);
    },
    [loadStateAndAnnounce]
  );

  const setRegion = useCallback((nextRegion) => {
    setRegionState(nextRegion);
  }, []);

  const handleSelectCourse = useCallback((course) => {
    setSelectedCourse(course);
    setSelectedDetail({ loading: true });
    getCourseById(course.id)
      .then((detail) => {
        const primaryTee = detail.tees?.male?.[0] ?? detail.tees?.female?.[0] ?? null;
        setSelectedDetail({
          loading: false,
          holes: primaryTee?.number_of_holes ?? null,
          par: primaryTee?.par_total ?? null,
        });
      })
      .catch((err) => {
        const message = err instanceof RateLimitError ? 'Daily limit reached' : 'Unavailable';
        setSelectedDetail({ loading: false, error: message });
      });
  }, []);

  const clearSelectedCourse = useCallback(() => {
    setSelectedCourse(null);
    setSelectedDetail(null);
  }, []);

  const clearPlayedFilter = useCallback(() => {
    setFilter(MAP_FILTERS.ALL);
    setMyCoursesLoaded(false);
  }, []);

  const handleSearchQueryChange = useCallback((text) => {
    setSearchQuery(text);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const trimmed = text.trim();
    if (!trimmed) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      const requestId = ++searchRequestIdRef.current;
      setSearching(true);
      try {
        const results = await searchCourses(trimmed);
        if (requestId === searchRequestIdRef.current) setSearchResults(results);
      } catch (err) {
        console.error('[useCourseMapData] search failed:', err.message);
        if (requestId === searchRequestIdRef.current) setSearchResults([]);
      } finally {
        if (requestId === searchRequestIdRef.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  const clearSearch = useCallback(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
  }, []);

  const handleSelectSearchResult = useCallback((course) => {
    clearSearch();
    if (course.lat != null && course.lng != null) {
      const nextRegion = {
        latitude: course.lat,
        longitude: course.lng,
        latitudeDelta: SEARCH_FOCUS_DELTA,
        longitudeDelta: SEARCH_FOCUS_DELTA,
      };
      setRegionState(nextRegion);
      setFocusRegion({ ...nextRegion, key: `search-${course.id}-${Date.now()}` });
    }
    handleSelectCourse(course);
  }, [clearSearch, handleSelectCourse]);

  const goToCourseDetail = useCallback(() => {
    if (!selectedCourse || !navigation) return;
    const course = selectedCourse;
    clearSelectedCourse();
    navigation.navigate('CourseDetail', {
      courseId: course.id,
      courseName: course.name,
      city: course.city,
      state: course.state,
    });
  }, [selectedCourse, navigation, clearSelectedCourse]);

  return {
    region,
    setRegion,
    focusRegion,
    zoomLevel,
    stateMarkers,
    currentStateAbbr,
    currentStateName: currentStateAbbr ? stateCenters[currentStateAbbr].name : null,
    currentStateLoading,
    countBanner,
    handleSelectStateMarker,
    visibleCourses,
    quotaExceeded,
    locationDenied,
    selectedCourse,
    selectedDetail,
    handleSelectCourse,
    clearSelectedCourse,
    goToCourseDetail,
    filter,
    setFilter,
    clearPlayedFilter,
    myCoursesLoading,
    myCoursesLoaded,
    userLocation,
    searchQuery,
    searchResults,
    searching,
    handleSearchQueryChange,
    clearSearch,
    handleSelectSearchResult,
  };
}
