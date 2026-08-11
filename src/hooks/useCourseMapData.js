import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { stateCenters, allStateAbbreviations } from '../data/courses';
import { getCourseById, searchCourses, RateLimitError } from '../services/golfCourseApi';
import { getPostsForCourse, updatePostCoordinates } from '../services/posts';
import { geocodeCourseCoordinates } from '../services/geocoding';
import { getMyCourses, updateMyCourseCoordinates, getSavedCourseCoordinates } from '../services/myCourses';
import { getAllCoursesInState } from '../services/stateCourses';
import { courseHasValidCoordinates } from '../utils/mapCoords';
import { getStateZoomCenter, zoomLevelToDelta, STATE_ZOOM_LEVEL } from '../utils/stateZoomCenters';

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

// How tight the map zooms in when a search result or feed course is
// focused/selected.
export const SEARCH_FOCUS_DELTA = 0.02;
export const STATE_FOCUS_DELTA = 4;
const SEARCH_DEBOUNCE_MS = 400;

// How long the feed course-name-tap flow waits, once the flag is down, before
// auto-navigating to Course Detail — the countdown pill counts down these
// same seconds (see `autoNavigateSecondsLeft` below).
const AUTO_NAVIGATE_SECONDS = 3;

export const MAP_FILTERS = { ALL: 'all', PLAYED: 'played' };

// Two zoom tiers: COUNTRY (full US view — 50 one-per-state pins, no course
// data) and everything more zoomed-in, where the search bar takes over.
// golfcourseapi.com can't be searched reliably by state name (it returns
// mismatched results), so there's no bulk "load every course in this state"
// step anymore — courses only appear on the map via search or the "Played"
// filter.
export const ZOOM_LEVEL = { COUNTRY: 'country', STATE: 'state', REGION: 'region' };
const COUNTRY_ZOOM_DELTA = 15;
const STATE_ZOOM_DELTA = 1.2;

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

// Platform-agnostic course map state/logic (zoom-based state loading, course
// selection, search, and the played-courses filter). Both MapScreen.js
// (react-native-maps) and MapScreen.web.js (react-leaflet) drive this same
// hook and only differ in how they render the map surface and markers.
export function useCourseMapData({
  navigation,
  routeFocusCourse,
  routeTimestamp,
  routeZoomToState,
  routeZoomToStateTimestamp,
  userId,
} = {}) {
  const [region, setRegionState] = useState(US_INITIAL_REGION);
  // Set when the hook wants the map to jump somewhere outside of user
  // panning (initial location fix, a state pin tap, a search result, or a
  // feed course focus). Each platform watches this and drives its own map's
  // recenter API off of it.
  const [focusRegion, setFocusRegion] = useState(null);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null); // { holes, loading, error }
  // The pin dropped when a course name is tapped from the feed — separate
  // from selectedCourse since it's a passive labeled pin (no detail fetch,
  // no popup card), shown alongside whatever the current filter renders.
  const [feedFocusPin, setFeedFocusPin] = useState(null);
  // Set once that same feed-tap flow successfully resolves a course (see the
  // routeZoomToState effect below) — drives the "heading to course page…"
  // banner and the countdown pill that auto-navigates to Course Detail.
  // `key` uniquely identifies each tap so the countdown effect below only
  // (re)starts when it actually changes, not on every re-render.
  const [courseAutoNavigate, setCourseAutoNavigate] = useState(null);
  const [autoNavigateSecondsLeft, setAutoNavigateSecondsLeft] = useState(AUTO_NAVIGATE_SECONDS);
  // Defaults to the user's saved courses (My Courses) — the map opens
  // showing only those pins rather than an empty "All Courses" view.
  const [filter, setFilter] = useState(MAP_FILTERS.PLAYED);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchDebounceRef = useRef(null);
  const searchRequestIdRef = useRef(0);
  const courseDetailRequestIdRef = useRef(0);
  // My Courses (the user's own my_courses table) is a permanent map layer —
  // it's fetched on mount and shown regardless of the ALL/PLAYED filter or
  // zoom level (see visibleCourses below), not gated behind the filter the
  // way it used to be. `myCoursesRefreshKey` lets a screen force a refetch
  // (e.g. on tab focus) so a course added elsewhere in the app shows up on
  // the map without needing a reload.
  const [myCoursesList, setMyCoursesList] = useState([]);
  const [myCoursesLoading, setMyCoursesLoading] = useState(false);
  const [myCoursesLoaded, setMyCoursesLoaded] = useState(false);
  const [myCoursesRefreshKey, setMyCoursesRefreshKey] = useState(0);

  const refreshMyCourses = useCallback(() => {
    setMyCoursesRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!userId) {
      setMyCoursesList([]);
      setMyCoursesLoaded(true);
      return;
    }
    let cancelled = false;
    setMyCoursesLoading(true);
    console.log('[useCourseMapData] fetching my_courses for userId:', userId);
    getMyCourses(userId)
      .then(async (rows) => {
        console.log('[useCourseMapData] my_courses rows fetched:', rows.length);
        if (cancelled) return;
        // Rows saved before they had coordinates (or whose address didn't
        // geocode at save time) still need a pin — geocode them now via
        // Nominatim and persist the result so this only happens once.
        const withCoords = [];
        for (const r of rows) {
          let lat = r.latitude;
          let lng = r.longitude;
          if (lat == null || lng == null) {
            console.log(`[useCourseMapData] "${r.courseName}" has no stored coordinates — geocoding`);
            // The my_courses table is world-readable (see schema.sql), so
            // another user may have already geocoded this same course_id —
            // check there before spending a Nominatim request on it.
            const saved = r.courseId ? await getSavedCourseCoordinates(r.courseId).catch(() => null) : null;
            const coords = saved ?? (await geocodeCourseCoordinates({
              id: r.courseId || r.id,
              name: r.courseName,
              city: r.city,
              state: r.state,
            }));
            if (coords) {
              lat = coords.lat;
              lng = coords.lng;
              console.log(`[useCourseMapData] geocoded "${r.courseName}":`, coords, '— persisting to my_courses row', r.id);
              updateMyCourseCoordinates(r.id, { latitude: lat, longitude: lng }).catch((err) =>
                console.error(`[useCourseMapData] failed to persist geocoded coordinates for "${r.courseName}":`, err.message)
              );
            } else {
              console.log(`[useCourseMapData] could not geocode "${r.courseName}" — no pin will be shown`);
            }
          }
          if (lat != null && lng != null) {
            withCoords.push({ id: r.courseId || r.id, name: r.courseName, city: r.city, state: r.state, lat, lng });
          }
        }
        console.log('[useCourseMapData] my_courses ready to render:', withCoords.length, 'of', rows.length, 'rows');
        if (!cancelled) setMyCoursesList(withCoords);
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
  }, [userId, myCoursesRefreshKey]);

  // "All Courses" (zoomed into a state) — every course this app knows about
  // in that state, aggregated from all users' my_courses/posts/scorecards
  // (see getAllCoursesInState). Refetches whenever the nearest-state guess
  // changes while panning.
  const [allStateCoursesList, setAllStateCoursesList] = useState([]);

  const zoomLevel = useMemo(() => getZoomLevel(region), [region]);
  const currentStateAbbr = useMemo(
    () => (zoomLevel === ZOOM_LEVEL.COUNTRY ? null : nearestState(region)),
    [zoomLevel, region]
  );

  useEffect(() => {
    if (filter !== MAP_FILTERS.ALL || !currentStateAbbr) {
      setAllStateCoursesList([]);
      return;
    }
    let cancelled = false;
    getAllCoursesInState(currentStateAbbr)
      .then((courses) => {
        if (!cancelled) setAllStateCoursesList(courses);
      })
      .catch((err) => {
        console.error('[useCourseMapData] failed to load state courses:', err.message);
        if (!cancelled) setAllStateCoursesList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [filter, currentStateAbbr]);

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

  const handleSelectCourse = useCallback((course) => {
    // Guards against rapid successive marker taps firing overlapping detail
    // requests — only the latest tap's response is applied.
    const requestId = ++courseDetailRequestIdRef.current;
    setSelectedCourse(course);
    setSelectedDetail({ loading: true });
    getCourseById(course.id)
      .then((detail) => {
        if (requestId !== courseDetailRequestIdRef.current) return;
        const primaryTee = detail.tees?.male?.[0] ?? detail.tees?.female?.[0] ?? null;
        setSelectedDetail((prev) => ({
          ...prev,
          loading: false,
          holes: primaryTee?.number_of_holes ?? null,
          par: primaryTee?.par_total ?? null,
        }));
      })
      .catch((err) => {
        if (requestId !== courseDetailRequestIdRef.current) return;
        const message = err instanceof RateLimitError ? 'Daily limit reached' : 'Unavailable';
        setSelectedDetail((prev) => ({ ...prev, loading: false, error: message }));
      });

    // Separate fetch (and merged into selectedDetail independently of the
    // tee-data request above) so a slow/failed golfcourseapi.com lookup
    // never blocks which nines show up in the popup, and vice versa.
    getPostsForCourse({ courseId: course.id, courseName: course.name })
      .then((posts) => {
        if (requestId !== courseDetailRequestIdRef.current) return;
        const nines = [...new Set(posts.map((p) => p.compositeName).filter(Boolean))];
        setSelectedDetail((prev) => ({ ...prev, nines }));
      })
      .catch((err) => {
        console.error('Failed to load posts for course map popup:', err);
      });
  }, []);

  // The Golf Course API's search endpoint doesn't return usable coordinates,
  // so a course picked from a search result (or matched from a feed post)
  // needs to be geocoded via OpenStreetMap/Nominatim before the map can zoom
  // to it and drop its pin. If geocoding comes up empty, the course is still
  // selected (its detail popup has everything it needs without coordinates)
  // — the map just doesn't move and no pin is placed.
  const focusCourseWithCoordinates = useCallback(
    async (course, regionKey) => {
      let resolved = course;
      if (!courseHasValidCoordinates(resolved)) {
        const coords = await geocodeCourseCoordinates(resolved);
        if (coords) resolved = { ...resolved, ...coords };
      }
      if (courseHasValidCoordinates(resolved)) {
        const nextRegion = {
          latitude: resolved.lat,
          longitude: resolved.lng,
          latitudeDelta: SEARCH_FOCUS_DELTA,
          longitudeDelta: SEARCH_FOCUS_DELTA,
        };
        setRegionState(nextRegion);
        setFocusRegion({ ...nextRegion, key: regionKey });
      } else {
        console.warn(`[useCourseMapData] no coordinates found for "${resolved.name}" — showing popup without moving the map`);
      }
      handleSelectCourse(resolved);
    },
    [handleSelectCourse]
  );

  // Feed's per-post state badge navigates here with a course to focus on
  // (see FeedScreen.handleStatePress). If the post didn't have stored
  // coordinates, look the course up by name via the Golf Course API and then
  // geocode it before dropping the pin.
  useEffect(() => {
    if (!routeFocusCourse) return;
    let cancelled = false;

    (async () => {
      let course = routeFocusCourse;
      if (!courseHasValidCoordinates(course)) {
        try {
          const results = await searchCourses(course.name);
          const match =
            results.find(
              (c) => c.state && course.state && c.state.toUpperCase() === course.state.toUpperCase()
            ) ?? results[0];
          if (match) {
            course = { ...match, id: course.id ?? match.id, name: course.name || match.name };
          }
        } catch (err) {
          console.error(`[useCourseMapData] course lookup failed for "${course.name}":`, err.message);
        }
      }
      if (cancelled) return;
      await focusCourseWithCoordinates(course, `feed-${course.id ?? course.name}-${routeTimestamp}`);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFocusCourse, routeTimestamp]);

  // Feed's course-name tap (see FeedScreen.handleCoursePress). Three stages:
  // (1) immediately zoom out to the course's whole state — using a small
  // set of specified centers for a few states and each other state's
  // capital otherwise (see stateZoomCenters) — so the screen shows
  // *something* right away instead of sitting on the old region while the
  // course is located; (2) once real coordinates are in hand (already on
  // the post, or geocoded via Nominatim as a fallback), animate in tight on
  // the course itself and drop the 1.5x flag there; (3) arm the auto-navigate
  // countdown so the screen doesn't just sit there afterward — see
  // `courseAutoNavigate` below, which the countdown effect and the
  // banner/pill UI (MapScreen/MapScreen.web) key off of. A post with no
  // stored coordinates that successfully geocodes gets them written back
  // (see updatePostCoordinates) so the next tap on it skips straight to
  // stage 2.
  useEffect(() => {
    if (!routeZoomToState) return;
    let cancelled = false;

    const center = getStateZoomCenter(routeZoomToState.state);
    if (center) {
      const delta = zoomLevelToDelta(STATE_ZOOM_LEVEL);
      const nextRegion = {
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: delta,
        longitudeDelta: delta,
      };
      setRegionState(nextRegion);
      setFocusRegion({ ...nextRegion, key: `feed-state-${routeZoomToState.state}-${routeZoomToStateTimestamp}` });
    } else {
      console.warn(`[useCourseMapData] no zoom center found for state "${routeZoomToState.state}"`);
    }

    (async () => {
      let { lat, lng } = routeZoomToState;
      const hadStoredCoordinates = courseHasValidCoordinates({ lat, lng });
      // Feed posts don't always carry stored coordinates — geocode the
      // course via Nominatim so the pin can still be placed exactly. Passing
      // city (when known) alongside name/state is what makes this match
      // reliably — see geocodeQueryChain in services/geocoding.js.
      if (!hadStoredCoordinates && routeZoomToState.courseName) {
        const coords = await geocodeCourseCoordinates({
          id: routeZoomToState.courseId || `${routeZoomToState.courseName}-${routeZoomToState.state}`,
          name: routeZoomToState.courseName,
          city: routeZoomToState.city,
          state: routeZoomToState.state,
        });
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
        }
      }
      if (cancelled) return;

      if (courseHasValidCoordinates({ lat, lng })) {
        setFeedFocusPin({ name: routeZoomToState.courseName, lat, lng });
        const nextRegion = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: SEARCH_FOCUS_DELTA,
          longitudeDelta: SEARCH_FOCUS_DELTA,
        };
        setRegionState(nextRegion);
        setFocusRegion({
          ...nextRegion,
          key: `feed-course-${routeZoomToState.courseName}-${routeZoomToStateTimestamp}`,
        });
        if (!hadStoredCoordinates && routeZoomToState.postId) {
          updatePostCoordinates(routeZoomToState.postId, lat, lng);
        }
        setCourseAutoNavigate({
          courseId: routeZoomToState.courseId ?? null,
          courseName: routeZoomToState.courseName,
          city: routeZoomToState.city ?? null,
          state: routeZoomToState.state ?? null,
          lat,
          lng,
          key: `feed-course-${routeZoomToState.courseName}-${routeZoomToStateTimestamp}`,
        });
      } else {
        // Geocoding came up empty — stay at the stage-1 state-wide view
        // rather than dropping a pin at a coordinate that isn't actually
        // this course.
        setFeedFocusPin(null);
        setCourseAutoNavigate(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [routeZoomToState, routeZoomToStateTimestamp]);

  // Where the auto-navigate countdown (below) sends the user once it fires —
  // switches the Tabs navigator's active tab to Feed *first* so that when
  // Course Detail (and the Course Feed it immediately opens into, see
  // CourseDetailScreen's `autoOpenAllPosts`) is later backed out of, it lands
  // on Feed rather than back on this Map screen.
  const navigateToCourseDetailFromFeedTap = useCallback(
    (info) => {
      if (!navigation || !info) return;
      navigation.navigate('Tabs', { screen: 'Feed' });
      navigation.navigate('CourseDetail', {
        courseId: info.courseId,
        courseName: info.courseName,
        city: info.city,
        state: info.state,
        lat: info.lat,
        lng: info.lng,
        autoOpenAllPosts: true,
      });
    },
    [navigation]
  );

  // Drives the countdown pill (Fix, Step 3): once `courseAutoNavigate` is
  // armed by the routeZoomToState effect above, ticks
  // `autoNavigateSecondsLeft` down once a second and navigates to Course
  // Detail when it reaches 0. Keyed on `courseAutoNavigate?.key` rather than
  // the object itself so it doesn't restart on unrelated re-renders.
  useEffect(() => {
    if (!courseAutoNavigate) return undefined;
    setAutoNavigateSecondsLeft(AUTO_NAVIGATE_SECONDS);
    const interval = setInterval(() => {
      setAutoNavigateSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigateToCourseDetailFromFeedTap(courseAutoNavigate);
          setCourseAutoNavigate(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseAutoNavigate?.key]);

  // Tapping the countdown pill skips straight to Course Detail instead of
  // waiting out the rest of the countdown.
  const skipCourseAutoNavigate = useCallback(() => {
    if (!courseAutoNavigate) return;
    const info = courseAutoNavigate;
    setCourseAutoNavigate(null);
    navigateToCourseDetailFromFeedTap(info);
  }, [courseAutoNavigate, navigateToCourseDetailFromFeedTap]);

  // My Courses pins are always part of the visible set — a permanent layer,
  // independent of the ALL/PLAYED filter and zoom level. The filter only
  // controls whether the "All Courses" layer (every course this app knows
  // about in the zoomed-into state, via getAllCoursesInState) is layered in
  // on top of it. Each course is tagged `isMine` so callers can color My
  // Courses pins (green) distinctly from the rest without re-deriving it
  // from the filter themselves.
  const visibleCourses = useMemo(() => {
    const stateLayer = filter === MAP_FILTERS.ALL && zoomLevel !== ZOOM_LEVEL.COUNTRY ? allStateCoursesList : [];
    const myIds = new Set(myCoursesList.map((c) => c.id));

    const merged = myCoursesList.map((c) => ({ ...c, isMine: true }));
    for (const c of stateLayer) {
      if (!myIds.has(c.id)) merged.push({ ...c, isMine: false });
    }

    // Always keep the selected/focused course pinned and visible on top of
    // whatever's already shown — a search result or a course opened from
    // the feed may not be in the merged list at all, and should still show
    // as a temporary pin alongside it. Skip courses with no coordinates —
    // they can't be placed as a marker and would crash the underlying map
    // (react-native-maps / react-leaflet don't guard this).
    if (
      selectedCourse &&
      courseHasValidCoordinates(selectedCourse) &&
      !merged.some((c) => c.id === selectedCourse.id)
    ) {
      merged.push({ ...selectedCourse, isMine: myIds.has(selectedCourse.id) });
    }
    return merged;
  }, [filter, myCoursesList, allStateCoursesList, zoomLevel, selectedCourse]);

  // Tapping a state pin zooms in and resets the search bar to empty/ready
  // for a course-name search — no course data is fetched.
  const handleSelectStateMarker = useCallback((abbr) => {
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

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setSearching(false);
    courseDetailRequestIdRef.current += 1;
    setSelectedCourse(null);
    setSelectedDetail(null);
  }, []);

  const setRegion = useCallback((nextRegion) => {
    setRegionState(nextRegion);
  }, []);

  const clearSelectedCourse = useCallback(() => {
    courseDetailRequestIdRef.current += 1;
    setSelectedCourse(null);
    setSelectedDetail(null);
  }, []);

  const clearPlayedFilter = useCallback(() => {
    setFilter(MAP_FILTERS.ALL);
    setMyCoursesLoaded(false);
  }, []);

  // Searches by course name only — the text the user typed is sent straight
  // through as golfcourseapi.com's search_query, unscoped to any state.
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
        if (requestId === searchRequestIdRef.current) {
          setSearchResults(results);
          setQuotaExceeded(false);
        }
      } catch (err) {
        console.error('[useCourseMapData] search failed:', err.message);
        if (requestId === searchRequestIdRef.current) {
          setSearchResults([]);
          if (err instanceof RateLimitError) setQuotaExceeded(true);
        }
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

  const handleSelectSearchResult = useCallback(
    (course) => {
      clearSearch();
      focusCourseWithCoordinates(course, `search-${course.id}-${Date.now()}`);
    },
    [clearSearch, focusCourseWithCoordinates]
  );

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
    handleSelectStateMarker,
    visibleCourses,
    quotaExceeded,
    locationDenied,
    selectedCourse,
    selectedDetail,
    handleSelectCourse,
    clearSelectedCourse,
    goToCourseDetail,
    feedFocusPin,
    courseAutoNavigate,
    autoNavigateSecondsLeft,
    skipCourseAutoNavigate,
    filter,
    setFilter,
    clearPlayedFilter,
    myCoursesList,
    myCoursesLoading,
    myCoursesLoaded,
    refreshMyCourses,
    userLocation,
    searchQuery,
    searchResults,
    searching,
    handleSearchQueryChange,
    clearSearch,
    handleSelectSearchResult,
  };
}
