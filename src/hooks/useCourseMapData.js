import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { seedCoursesByState, stateCenters, allStateAbbreviations } from '../data/courses';
import { isCoursePlayed } from '../data/playedCourses';
import { geocodeCourse, getCachedGeocode } from '../services/geocoding';
import { discoverCoursesNear, getAllDiscoveredCourses, sweepAllStates } from '../services/courseDiscovery';
import { getCourseById, RateLimitError } from '../services/golfCourseApi';

// Geographic center of the contiguous US — where the map view starts on load.
export const US_INITIAL_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 45,
  longitudeDelta: 45,
};

// The literal geographic center falls in rural Mitchell County, KS, which
// reverse-geocodes to a county with no indexed courses and no real text-search
// hit. Wichita is the nearest major city, so initial discovery targets it
// instead — still "near the center of the US", but guaranteed real results.
const US_CENTER_DISCOVERY_POINT = { latitude: 37.6872, longitude: -97.3301 };

export const USER_LOCATION_FOCUS_DELTA = 2;
const PAN_DISCOVERY_DEBOUNCE_MS = 900;
// Skip re-discovery if the map center hasn't moved roughly this far (degrees).
const MIN_REFETCH_DISTANCE = 0.4;

export const MAP_FILTERS = { ALL: 'all', PLAYED: 'played' };

function statesInBounds(region) {
  const latMin = region.latitude - region.latitudeDelta / 2;
  const latMax = region.latitude + region.latitudeDelta / 2;
  const lngMin = region.longitude - region.longitudeDelta / 2;
  const lngMax = region.longitude + region.longitudeDelta / 2;
  return allStateAbbreviations.filter((abbr) => {
    const c = stateCenters[abbr];
    return c.lat >= latMin && c.lat <= latMax && c.lng >= lngMin && c.lng <= lngMax;
  });
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

function distance(a, b) {
  return Math.hypot(a.latitude - b.latitude, a.longitude - b.longitude);
}

// Platform-agnostic course map state/logic (region tracking, seed geocoding,
// live discovery, course selection, played-courses filter). Both MapScreen.js
// (react-native-maps) and MapScreen.web.js (react-leaflet) drive this same
// hook and only differ in how they render the map surface and markers.
export function useCourseMapData({ navigation, routeState, routeTimestamp } = {}) {
  const debounceRef = useRef(null);
  const lastFetchedCenterRef = useRef(null);
  const [region, setRegionState] = useState(US_INITIAL_REGION);
  // Set when the hook wants the map to jump somewhere outside of user
  // panning (initial location fix, or a state focus request). Each platform
  // watches this and drives its own map's recenter API off of it.
  const [focusRegion, setFocusRegion] = useState(null);
  const [courses, setCourses] = useState({}); // id -> { id, name, city, state, lat, lng }
  const [geocodingStates, setGeocodingStates] = useState({});
  const [discovering, setDiscovering] = useState(false);
  const [sweepingStates, setSweepingStates] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null); // { holes, loading, error }
  const [filter, setFilter] = useState(MAP_FILTERS.ALL);
  const [userLocation, setUserLocation] = useState(null);

  const visibleStates = useMemo(() => statesInBounds(region), [region]);
  const courseList = useMemo(() => Object.values(courses), [courses]);
  const filteredCourseList = useMemo(
    () => (filter === MAP_FILTERS.PLAYED ? courseList.filter((c) => isCoursePlayed(c.id)) : courseList),
    [courseList, filter]
  );
  const visibleCourses = useMemo(
    () => coursesInBounds(filteredCourseList, region),
    [filteredCourseList, region]
  );

  const mergeCourses = useCallback((list) => {
    if (!list.length) return;
    setCourses((prev) => {
      const next = { ...prev };
      list.forEach((c) => {
        next[c.id] = c;
      });
      return next;
    });
  }, []);

  // Baseline: one real, API-verified course per state (see scripts/fetchCourseSeeds.mjs),
  // geocoded up front — works even with no live search quota.
  const ensureSeedGeocoded = useCallback(async (abbr) => {
    const course = seedCoursesByState[abbr];
    if (!course) {
      console.warn(`[useCourseMapData] no seed course for state ${abbr} — pin will be missing`);
      return;
    }
    if (courses[course.id] || geocodingStates[abbr]) return;

    const cached = await getCachedGeocode(course.id);
    if (cached) {
      mergeCourses([{ ...course, lat: cached.lat, lng: cached.lng }]);
      return;
    }

    setGeocodingStates((prev) => ({ ...prev, [abbr]: true }));
    try {
      const coord = await geocodeCourse(course.id, course.address, {
        name: course.name,
        city: course.city,
        state: course.state,
      });
      console.log(`[useCourseMapData] geocoded seed for ${abbr}: ${course.name} ->`, coord);
      mergeCourses([{ ...course, lat: coord.lat, lng: coord.lng }]);
    } catch (err) {
      console.error(`[useCourseMapData] geocoding failed for ${abbr} (${course.name}):`, err.message);
    } finally {
      setGeocodingStates((prev) => ({ ...prev, [abbr]: false }));
    }
  }, [courses, geocodingStates, mergeCourses]);

  // Load anything discovered in previous sessions immediately (no network).
  useEffect(() => {
    getAllDiscoveredCourses().then(mergeCourses);
  }, [mergeCourses]);

  // Backfill the one-per-state seed courses for every state up front, not
  // just whichever states are currently in view — otherwise the initial
  // full-US zoom-out shows nothing until discovery finds something nearby.
  // geocodeCourse shares a single throttled (~1/sec) Nominatim queue and
  // caches results in AsyncStorage, so this costs a few dozen seconds once
  // and is instant on every later launch.
  useEffect(() => {
    allStateAbbreviations.forEach((abbr) => ensureSeedGeocoded(abbr));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sweep every state with a real "golf courses <state>" search so the map
  // shows more than one course per state without waiting for the user to pan
  // there. One request per state, 500ms apart; resumes across sessions from
  // wherever it left off (see sweepAllStates), so this is safe to fire on
  // every mount.
  useEffect(() => {
    const stateAbbrToName = Object.fromEntries(
      allStateAbbreviations.map((abbr) => [abbr, stateCenters[abbr].name])
    );
    setSweepingStates(true);
    sweepAllStates(stateAbbrToName, mergeCourses)
      .then((result) => {
        if (result.quotaExceeded) setQuotaExceeded(true);
      })
      .finally(() => setSweepingStates(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runDiscovery = useCallback(async (lat, lng) => {
    setDiscovering(true);
    try {
      const result = await discoverCoursesNear(lat, lng);
      if (result.quotaExceeded) {
        setQuotaExceeded(true);
      } else if (result.courses.length) {
        setQuotaExceeded(false);
        mergeCourses(result.courses);
      }
    } finally {
      setDiscovering(false);
    }
  }, [mergeCourses]);

  // Fetch courses near the center of the US as soon as the map loads, so
  // there's real data on screen before location permission (which may be
  // denied) resolves.
  useEffect(() => {
    lastFetchedCenterRef.current = {
      latitude: US_INITIAL_REGION.latitude,
      longitude: US_INITIAL_REGION.longitude,
    };
    runDiscovery(US_CENTER_DISCOVERY_POINT.latitude, US_CENTER_DISCOVERY_POINT.longitude);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Then also fetch courses near the user and recenter the map there.
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
        lastFetchedCenterRef.current = { latitude, longitude };
        runDiscovery(latitude, longitude);
      } catch (err) {
        console.warn('Could not get current location:', err.message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed's per-post state badge navigates here with { state, timestamp }.
  useEffect(() => {
    if (!routeState || !stateCenters[routeState]) return;
    const center = stateCenters[routeState];
    const nextRegion = {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: USER_LOCATION_FOCUS_DELTA,
      longitudeDelta: USER_LOCATION_FOCUS_DELTA,
    };
    setRegionState(nextRegion);
    setFocusRegion({ ...nextRegion, key: `${routeState}-${routeTimestamp}` });
    lastFetchedCenterRef.current = { latitude: center.lat, longitude: center.lng };
    runDiscovery(center.lat, center.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeState, routeTimestamp]);

  const setRegion = useCallback((nextRegion) => {
    setRegionState(nextRegion);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const last = lastFetchedCenterRef.current;
    if (last && distance(last, nextRegion) < MIN_REFETCH_DISTANCE) return;

    debounceRef.current = setTimeout(() => {
      lastFetchedCenterRef.current = { latitude: nextRegion.latitude, longitude: nextRegion.longitude };
      runDiscovery(nextRegion.latitude, nextRegion.longitude);
    }, PAN_DISCOVERY_DEBOUNCE_MS);
  }, [runDiscovery]);

  const handleSelectCourse = useCallback((course) => {
    setSelectedCourse(course);
    setSelectedDetail({ loading: true });
    getCourseById(course.id)
      .then((detail) => {
        const primaryTee = detail.tees?.male?.[0] ?? detail.tees?.female?.[0] ?? null;
        setSelectedDetail({ loading: false, holes: primaryTee?.number_of_holes ?? null });
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
    visibleStates,
    visibleCourses,
    geocodingStates,
    discovering,
    sweepingStates,
    quotaExceeded,
    locationDenied,
    selectedCourse,
    selectedDetail,
    handleSelectCourse,
    clearSelectedCourse,
    goToCourseDetail,
    filter,
    setFilter,
    userLocation,
  };
}
