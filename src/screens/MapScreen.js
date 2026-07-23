import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import Header from '../components/Header';
import colors from '../theme/colors';
import { darkSlateMapStyle } from '../theme/mapStyle';
import { seedCoursesByState, stateCenters, allStateAbbreviations } from '../data/courses';
import { geocodeCourse, getCachedGeocode } from '../services/geocoding';
import { discoverCoursesNear, getAllDiscoveredCourses } from '../services/courseDiscovery';
import { getCourseById, RateLimitError } from '../services/golfCourseApi';

const US_INITIAL_REGION = {
  latitude: 39.5,
  longitude: -98.35,
  latitudeDelta: 45,
  longitudeDelta: 45,
};

// Below this zoomed-in threshold we switch from one-ball-per-state to
// individual course flags for states inside the visible bounds.
const COURSE_TIER_LATITUDE_DELTA = 6;
const USER_LOCATION_FOCUS_DELTA = 2;
const PAN_DISCOVERY_DEBOUNCE_MS = 900;
// Skip re-discovery if the map center hasn't moved roughly this far (degrees).
const MIN_REFETCH_DISTANCE = 0.4;

const hasGoogleMapsKey = Boolean(Constants.expoConfig?.extra?.googleMapsApiKey);

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

function StateMarker({ abbr }) {
  const center = stateCenters[abbr];
  return (
    <Marker coordinate={{ latitude: center.lat, longitude: center.lng }} tracksViewChanges={false}>
      <View style={styles.stateMarker}>
        <Ionicons name="golf" size={16} color={colors.white} />
      </View>
    </Marker>
  );
}

function CourseMarker({ course, onPress }) {
  return (
    <Marker
      coordinate={{ latitude: course.lat, longitude: course.lng }}
      onPress={() => onPress(course)}
      tracksViewChanges={false}
    >
      <Ionicons name="flag" size={26} color={colors.red} />
    </Marker>
  );
}

export default function MapScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const debounceRef = useRef(null);
  const lastFetchedCenterRef = useRef(null);
  const [region, setRegion] = useState(US_INITIAL_REGION);
  const [courses, setCourses] = useState({}); // id -> { id, name, city, state, lat, lng }
  const [geocodingStates, setGeocodingStates] = useState({});
  const [discovering, setDiscovering] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null); // { holes, loading, error }

  const isCourseTier = region.latitudeDelta <= COURSE_TIER_LATITUDE_DELTA;
  const visibleStates = useMemo(() => statesInBounds(region), [region]);
  const courseList = useMemo(() => Object.values(courses), [courses]);
  const visibleCourses = useMemo(
    () => (isCourseTier ? coursesInBounds(courseList, region) : []),
    [isCourseTier, courseList, region]
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
  // geocoded lazily as its state comes into view — works even with no live search quota.
  const ensureSeedGeocoded = useCallback(async (abbr) => {
    const course = seedCoursesByState[abbr];
    if (!course || courses[course.id] || geocodingStates[abbr]) return;

    const cached = await getCachedGeocode(course.id);
    if (cached) {
      mergeCourses([{ ...course, lat: cached.lat, lng: cached.lng }]);
      return;
    }
    if (!hasGoogleMapsKey) return;

    setGeocodingStates((prev) => ({ ...prev, [abbr]: true }));
    try {
      const coord = await geocodeCourse(course.id, course.address);
      mergeCourses([{ ...course, lat: coord.lat, lng: coord.lng }]);
    } catch (err) {
      console.warn(`Geocoding failed for ${abbr}:`, err.message);
    } finally {
      setGeocodingStates((prev) => ({ ...prev, [abbr]: false }));
    }
  }, [courses, geocodingStates, mergeCourses]);

  // Load anything discovered in previous sessions immediately (no network).
  useEffect(() => {
    getAllDiscoveredCourses().then(mergeCourses);
  }, [mergeCourses]);

  useEffect(() => {
    if (!isCourseTier) return;
    visibleStates.forEach((abbr) => ensureSeedGeocoded(abbr));
  }, [isCourseTier, visibleStates, ensureSeedGeocoded]);

  const runDiscovery = useCallback(async (lat, lng) => {
    if (!hasGoogleMapsKey) return;
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

  // Fetch courses near the user on load, and recenter the map there.
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
        setRegion(nextRegion);
        mapRef.current?.animateToRegion(nextRegion, 600);
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
    const focusState = route?.params?.state;
    if (!focusState || !stateCenters[focusState]) return;
    const center = stateCenters[focusState];
    const nextRegion = {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: USER_LOCATION_FOCUS_DELTA,
      longitudeDelta: USER_LOCATION_FOCUS_DELTA,
    };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 600);
    lastFetchedCenterRef.current = { latitude: center.lat, longitude: center.lng };
    runDiscovery(center.lat, center.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.params?.state, route?.params?.timestamp]);

  const handleRegionChangeComplete = useCallback((nextRegion) => {
    setRegion(nextRegion);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (nextRegion.latitudeDelta > COURSE_TIER_LATITUDE_DELTA) return;

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

  const handleViewHoles = () => {
    if (!selectedCourse) return;
    const course = selectedCourse;
    setSelectedCourse(null);
    navigation.navigate('CourseDetail', {
      courseId: course.id,
      courseName: course.name,
      city: course.city,
      state: course.state,
    });
  };

  return (
    <View style={styles.screen}>
      <Header />

      {!hasGoogleMapsKey && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.gold} />
          <Text style={styles.warningText}>
            {Platform.OS === 'android'
              ? 'Add GOOGLE_MAPS_API_KEY to .env for map tiles and course discovery on Android.'
              : 'Add GOOGLE_MAPS_API_KEY to .env to discover and geocode course pins.'}
          </Text>
        </View>
      )}
      {hasGoogleMapsKey && locationDenied && (
        <View style={styles.warningBanner}>
          <Ionicons name="location-outline" size={14} color={colors.gold} />
          <Text style={styles.warningText}>
            Location permission denied — showing the national view instead of courses near you.
          </Text>
        </View>
      )}
      {quotaExceeded && (
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={14} color={colors.gold} />
          <Text style={styles.warningText}>
            Daily course search limit reached — showing previously found courses only.
          </Text>
        </View>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        userInterfaceStyle="dark"
        customMapStyle={Platform.OS === 'android' ? darkSlateMapStyle : undefined}
        initialRegion={US_INITIAL_REGION}
        showsUserLocation={!locationDenied}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {!isCourseTier &&
          allStateAbbreviations.map((abbr) => <StateMarker key={abbr} abbr={abbr} />)}

        {isCourseTier &&
          visibleCourses.map((course) => (
            <CourseMarker key={course.id} course={course} onPress={handleSelectCourse} />
          ))}
      </MapView>

      {(discovering || (isCourseTier && visibleStates.some((abbr) => geocodingStates[abbr]))) && (
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color={colors.red} />
          <Text style={styles.loadingBannerText}>Finding courses…</Text>
        </View>
      )}

      {selectedCourse && (
        <View style={styles.popupCard}>
          <TouchableOpacity
            style={styles.popupClose}
            onPress={() => {
              setSelectedCourse(null);
              setSelectedDetail(null);
            }}
          >
            <Ionicons name="close" size={18} color={colors.muted} />
          </TouchableOpacity>
          <Text style={styles.popupName}>{selectedCourse.name}</Text>
          <Text style={styles.popupLocation}>
            {selectedCourse.city}, {selectedCourse.state}
          </Text>

          <View style={styles.popupMetaRow}>
            <View style={styles.popupMetaItem}>
              <Text style={styles.popupMetaLabel}>Access</Text>
              <Text style={styles.popupMetaValue}>Not provided by data source</Text>
            </View>
            <View style={styles.popupMetaItem}>
              <Text style={styles.popupMetaLabel}>Holes</Text>
              {selectedDetail?.loading ? (
                <ActivityIndicator size="small" color={colors.muted} />
              ) : (
                <Text style={styles.popupMetaValue}>
                  {selectedDetail?.holes ?? selectedDetail?.error ?? '—'}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity style={styles.popupButton} onPress={handleViewHoles}>
            <Text style={styles.popupButtonText}>View holes & shots</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  map: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  warningText: {
    color: colors.muted,
    fontSize: 11,
    flex: 1,
  },
  stateMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  loadingBanner: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  loadingBannerText: {
    color: colors.muted,
    fontSize: 12,
  },
  popupCard: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 16,
    padding: 16,
  },
  popupClose: {
    position: 'absolute',
    top: 10,
    right: 10,
    padding: 4,
  },
  popupName: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginRight: 24,
  },
  popupLocation: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  popupMetaRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    marginBottom: 14,
  },
  popupMetaItem: {
    flex: 1,
  },
  popupMetaLabel: {
    color: colors.muted,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  popupMetaValue: {
    color: colors.offWhite,
    fontSize: 13,
    fontWeight: '600',
  },
  popupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.red,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  popupButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
