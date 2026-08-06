import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CourseSearchBar from '../components/map/CourseSearchBar';
import FriendSearchBar from '../components/map/FriendSearchBar';
import FilterPills from '../components/map/FilterPills';
import StatePushPin from '../components/map/StatePushPin';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import MapErrorBoundary from '../components/map/MapErrorBoundary';
import SilentMarkerBoundary from '../components/map/SilentMarkerBoundary';
import { MapWarningBanner, MapLoadingBanner } from '../components/map/MapMessageBanner';
import colors from '../theme/colors';
import { darkSlateMapStyle } from '../theme/mapStyle';
import {
  useCourseMapData,
  US_INITIAL_REGION,
  MAX_MAP_DELTA,
  MAP_FILTERS,
  ZOOM_LEVEL,
} from '../hooks/useCourseMapData';
import { useAuth } from '../context/AuthContext';
import { getFriendMyCourses } from '../services/friendMap';
import { filterCoursesWithValidCoordinates } from '../utils/mapCoords';

const ZOOM_MIN_DELTA = 0.01;
const ZOOM_MAX_DELTA = MAX_MAP_DELTA;

// react-native-maps fires marker/map event handlers outside a normal React
// render pass — an error thrown inside one can leave the native map view in
// a broken state rather than being caught the usual way. Catching and
// logging here keeps a bad tap from freezing the map.
function guard(fn) {
  return (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      console.error('[MapScreen] map event handler threw:', err);
    }
  };
}

// A course with no (or invalid) coordinates can't be placed as a marker —
// rendering one with a null/NaN/out-of-range lat/lng crashes the map, so
// it's filtered out here as a last line of defense and logged (courses are
// already filtered when loaded in useCourseMapData, but this keeps the map
// safe against any other source of course data too, e.g. friendFilter).
function withCoords(courses, context) {
  return filterCoursesWithValidCoordinates(courses, context);
}

// `green` marks pins from the user's own My Courses list (the map's default
// view) so they read distinctly from the red flag used for search results
// and course-detail "View on Map" focus.
function CourseMarker({ course, highlighted, green, onPress }) {
  return (
    <Marker
      coordinate={{ latitude: course.lat, longitude: course.lng }}
      onPress={() => onPress(course)}
      tracksViewChanges={highlighted}
      zIndex={highlighted ? 10 : 1}
    >
      {highlighted ? (
        <View style={styles.highlightedMarker}>
          <Ionicons name="flag" size={36} color={colors.red} />
        </View>
      ) : (
        <Ionicons name="location" size={28} color={green ? colors.green : colors.red} />
      )}
    </Marker>
  );
}

// Level 1 (zoomed-out full-US) pin — one per state, centered on that state's
// centroid. Tapping one zooms in and resets the search bar so the user can
// look up a course by name (see useCourseMapData.handleSelectStateMarker) —
// golfcourseapi.com can't be searched reliably by state name, so there's no
// bulk course load here.
function StateMarker({ state, onPress }) {
  return (
    <Marker
      coordinate={{ latitude: state.lat, longitude: state.lng }}
      onPress={() => onPress(state.abbr)}
      tracksViewChanges={false}
      zIndex={1}
    >
      <StatePushPin abbr={state.abbr} />
    </Marker>
  );
}

export default function MapScreen({ navigation, route }) {
  const { user } = useAuth();
  const mapRef = useRef(null);
  const [friendFilter, setFriendFilter] = useState(null); // { displayName, courses, loading }
  const {
    region,
    setRegion,
    focusRegion,
    zoomLevel,
    stateMarkers,
    currentStateName,
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
    searchQuery,
    searchResults,
    searching,
    handleSearchQueryChange,
    clearSearch,
    handleSelectSearchResult,
  } = useCourseMapData({
    navigation,
    routeFocusCourse: route?.params?.focusCourse,
    routeTimestamp: route?.params?.timestamp,
    userId: user?.id,
  });

  useEffect(() => {
    if (!focusRegion) return;
    mapRef.current?.animateToRegion(focusRegion, 600);
  }, [focusRegion]);

  useEffect(() => {
    if (!friendFilter || friendFilter.loading || friendFilter.courses.length === 0) return;
    const coords = friendFilter.courses.map((c) => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
      animated: true,
    });
  }, [friendFilter]);

  useEffect(() => {
    if (filter !== MAP_FILTERS.PLAYED || myCoursesLoading || visibleCourses.length === 0) return;
    const coords = visibleCourses.map((c) => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
      animated: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, myCoursesLoading, visibleCourses]);

  const handleSelectFriend = async (profile) => {
    clearSelectedCourse();
    const displayName = profile.full_name || profile.username || 'this golfer';
    setFriendFilter({ displayName, courses: [], loading: true });
    try {
      const courses = await getFriendMyCourses(profile.user_id);
      setFriendFilter({ displayName, courses, loading: false });
    } catch (err) {
      console.error("Failed to load friend's courses:", err);
      setFriendFilter({ displayName, courses: [], loading: false });
    }
  };

  const handleClearFriendFilter = () => {
    setFriendFilter(null);
    clearSelectedCourse();
  };

  const handleZoomIn = () => {
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: Math.max(region.latitudeDelta / 2, ZOOM_MIN_DELTA),
        longitudeDelta: Math.max(region.longitudeDelta / 2, ZOOM_MIN_DELTA),
      },
      300
    );
  };

  const handleZoomOut = () => {
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: Math.min(region.latitudeDelta * 2, ZOOM_MAX_DELTA),
        longitudeDelta: Math.min(region.longitudeDelta * 2, ZOOM_MAX_DELTA),
      },
      300
    );
  };

  return (
    <View style={styles.screen}>
      <Header />
      {zoomLevel !== ZOOM_LEVEL.COUNTRY && (
        <>
          <Text style={styles.searchHeading}>Search courses in {currentStateName}</Text>
          <CourseSearchBar
            query={searchQuery}
            onChangeQuery={handleSearchQueryChange}
            onClear={clearSearch}
            results={searchResults}
            searching={searching}
            onSelectResult={handleSelectSearchResult}
            placeholder={`Search courses in ${currentStateName}`}
          />
        </>
      )}
      <FriendSearchBar currentUserId={user?.id} onSelectFriend={handleSelectFriend} />
      <FilterPills value={filter} onChange={setFilter} />

      {friendFilter && (
        <View style={styles.friendBanner}>
          <Ionicons name="golf-outline" size={16} color={colors.white} />
          <Text style={styles.friendBannerText} numberOfLines={1}>
            {friendFilter.loading
              ? `Loading ${friendFilter.displayName}'s courses…`
              : friendFilter.courses.length > 0
              ? `Viewing ${friendFilter.displayName}'s courses`
              : `${friendFilter.displayName} hasn't added any courses yet`}
          </Text>
          <TouchableOpacity onPress={handleClearFriendFilter} style={styles.friendBannerClear}>
            <Text style={styles.friendBannerClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {filter === MAP_FILTERS.PLAYED && (
        <View style={styles.myCoursesBanner}>
          <Ionicons name="flag" size={16} color={colors.white} />
          <Text style={styles.myCoursesBannerText}>Showing My Courses</Text>
          <TouchableOpacity onPress={clearPlayedFilter} style={styles.myCoursesBannerClear}>
            <Text style={styles.myCoursesBannerClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {locationDenied && (
        <MapWarningBanner icon="location-outline">
          Location permission denied — tap a state to browse its courses.
        </MapWarningBanner>
      )}
      {quotaExceeded && (
        <MapWarningBanner icon="warning-outline">
          Daily course search limit reached — showing previously found courses only.
        </MapWarningBanner>
      )}

      <View style={styles.mapContainer}>
        <MapErrorBoundary>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            userInterfaceStyle="dark"
            customMapStyle={Platform.OS === 'android' ? darkSlateMapStyle : undefined}
            initialRegion={US_INITIAL_REGION}
            showsUserLocation={!locationDenied}
            onRegionChangeComplete={guard(setRegion)}
          >
            {!friendFilter && filter !== MAP_FILTERS.PLAYED && zoomLevel === ZOOM_LEVEL.COUNTRY
              ? stateMarkers.map((state) => (
                  <SilentMarkerBoundary key={state.abbr}>
                    <StateMarker state={state} onPress={guard(handleSelectStateMarker)} />
                  </SilentMarkerBoundary>
                ))
              : withCoords(friendFilter ? friendFilter.courses : visibleCourses, 'render markers').map((course) => (
                  <SilentMarkerBoundary key={course.id}>
                    <CourseMarker
                      course={course}
                      highlighted={selectedCourse?.id === course.id}
                      green={!friendFilter && filter === MAP_FILTERS.PLAYED}
                      onPress={guard(handleSelectCourse)}
                    />
                  </SilentMarkerBoundary>
                ))}
          </MapView>
        </MapErrorBoundary>

        <ZoomControls onZoomIn={guard(handleZoomIn)} onZoomOut={guard(handleZoomOut)} />

        {filter === MAP_FILTERS.PLAYED && myCoursesLoading && (
          <MapLoadingBanner>Loading your courses…</MapLoadingBanner>
        )}

        {filter === MAP_FILTERS.PLAYED && myCoursesLoaded && !myCoursesLoading && visibleCourses.length === 0 && (
          <View style={styles.emptyMyCoursesCard} pointerEvents="none">
            <Ionicons name="flag-outline" size={22} color={colors.muted} />
            <Text style={styles.emptyMyCoursesText}>Add courses to your profile to see them here</Text>
          </View>
        )}

        {selectedCourse && (
          <CoursePopupCard
            course={selectedCourse}
            detail={selectedDetail}
            onClose={clearSelectedCourse}
            onViewHoles={goToCourseDetail}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  mapContainer: {
    flex: 1,
  },
  searchHeading: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  friendBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.red,
    gap: 8,
  },
  friendBannerText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  friendBannerClear: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.red,
  },
  friendBannerClearText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  myCoursesBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.red,
    gap: 8,
  },
  myCoursesBannerText: {
    flex: 1,
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  myCoursesBannerClear: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: colors.red,
  },
  myCoursesBannerClearText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyMyCoursesCard: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    zIndex: 1000,
    maxWidth: 260,
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyMyCoursesText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  map: {
    flex: 1,
  },
  highlightedMarker: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(192, 0, 26, 0.18)',
    borderWidth: 2,
    borderColor: colors.red,
  },
});
