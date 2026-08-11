import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform, TouchableOpacity, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CourseSearchBar from '../components/map/CourseSearchBar';
import FriendSearchBar from '../components/map/FriendSearchBar';
import FilterPills from '../components/map/FilterPills';
import StatePushPin from '../components/map/StatePushPin';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import FeedCoursePopupCard from '../components/map/FeedCoursePopupCard';
import MapErrorBoundary from '../components/map/MapErrorBoundary';
import SilentMarkerBoundary from '../components/map/SilentMarkerBoundary';
import { MapWarningBanner } from '../components/map/MapMessageBanner';
import Toast from '../components/Toast';
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

// `green` marks pins from the user's own Courses Played list, or a friend's
// when a friend filter is active (the map's mapMarkers already tags both
// `isMine`/`isFriend`), so they read distinctly from the red flag used for
// search results and course-detail "View on Map" focus.
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

// Standard marker icon size (see CourseMarker's non-highlighted case) — the
// feed-focus pin below is sized relative to this.
const NORMAL_MARKER_ICON_SIZE = 28;
const FEED_FOCUS_ICON_SIZE = Math.round(NORMAL_MARKER_ICON_SIZE * 1.5);

// The pin dropped when a course name is tapped from the feed (see
// useCourseMapData's routeZoomToState handling) — a red flag, 1.5x the size
// of a normal course pin, with the course name shown as a permanently
// visible label underneath rather than a tap-to-reveal callout.
function FeedFocusMarker({ pin }) {
  return (
    <Marker
      coordinate={{ latitude: pin.lat, longitude: pin.lng }}
      anchor={{ x: 0.5, y: 1 }}
      tracksViewChanges={false}
      zIndex={15}
    >
      <View style={styles.feedFocusMarker}>
        <Ionicons name="flag" size={FEED_FOCUS_ICON_SIZE} color={colors.red} />
        <View style={styles.feedFocusLabel}>
          <Text style={styles.feedFocusLabelText} numberOfLines={1}>
            {pin.name}
          </Text>
        </View>
      </View>
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
  const [emptyMyCoursesToast, setEmptyMyCoursesToast] = useState(null);
  const playedEmptyToastShownRef = useRef(false);
  const {
    region,
    setRegion,
    focusRegion,
    zoomLevel,
    stateMarkers,
    currentStateName,
    handleSelectStateMarker,
    mapMarkers,
    friendFilter,
    showOwnCourses,
    setShowOwnCourses,
    loadFriendCourses,
    clearFriendFilter,
    quotaExceeded,
    locationDenied,
    selectedCourse,
    selectedDetail,
    handleSelectCourse,
    clearSelectedCourse,
    goToCourseDetail,
    feedFocusPin,
    feedCoursePopup,
    dismissFeedCoursePopup,
    goToCourseDetailFromFeedPopup,
    filter,
    setFilter,
    myCoursesList,
    myCoursesLoading,
    myCoursesLoaded,
    refreshMyCourses,
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
    routeZoomToState: route?.params?.zoomToState,
    routeZoomToStateTimestamp: route?.params?.zoomToStateAt,
    routeViewFriendUserId: route?.params?.viewFriendUserId,
    routeViewFriendUsername: route?.params?.viewFriendUsername,
    routeViewFriendName: route?.params?.viewFriendName,
    routeViewFriendTimestamp: route?.params?.viewFriendAt,
    userId: user?.id,
  });

  // The Map tab stays mounted across tab switches (bottom tab navigators
  // don't unmount screens), so a course added on the Profile tab wouldn't
  // otherwise show up here until the app reloads. Refetching my_courses
  // every time this screen regains focus keeps it in sync without a manual
  // refresh.
  useFocusEffect(
    useCallback(() => {
      console.log('[MapScreen] screen focused — refreshing my_courses');
      refreshMyCourses();
    }, [refreshMyCourses])
  );

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

  const hasFitMyCoursesRef = useRef(false);
  useEffect(() => {
    if (myCoursesLoading || myCoursesList.length === 0 || hasFitMyCoursesRef.current) return;
    hasFitMyCoursesRef.current = true;
    const coords = myCoursesList.map((c) => ({ latitude: c.lat, longitude: c.lng }));
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 120, right: 60, bottom: 200, left: 60 },
      animated: true,
    });
  }, [myCoursesLoading, myCoursesList]);

  // The only feedback for an empty My Courses list is this bottom toast,
  // not a banner or inline card. Shown once per app session (the ref never
  // resets), since the Map tab stays mounted and refetches on every focus.
  useEffect(() => {
    if (myCoursesLoading || !myCoursesLoaded || myCoursesList.length > 0) return;
    if (playedEmptyToastShownRef.current) return;
    playedEmptyToastShownRef.current = true;
    setEmptyMyCoursesToast('Add courses in your profile to see them here');
  }, [myCoursesLoading, myCoursesLoaded, myCoursesList]);

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
            placeholder="Search for a course"
          />
        </>
      )}
      <FriendSearchBar currentUserId={user?.id} onSelectFriend={loadFriendCourses} />
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
          <View style={styles.friendBannerToggle}>
            <Text style={styles.friendBannerToggleLabel}>Courses Played</Text>
            <Switch
              value={showOwnCourses}
              onValueChange={setShowOwnCourses}
              trackColor={{ false: colors.navyBorder, true: colors.brightGreen }}
              thumbColor={colors.white}
            />
          </View>
          <TouchableOpacity onPress={clearFriendFilter} style={styles.friendBannerClear}>
            <Text style={styles.friendBannerClearText}>Clear</Text>
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
            onPress={guard(() => feedCoursePopup && dismissFeedCoursePopup())}
          >
            {!friendFilter &&
              filter !== MAP_FILTERS.PLAYED &&
              zoomLevel === ZOOM_LEVEL.COUNTRY &&
              stateMarkers.map((state) => (
                <SilentMarkerBoundary key={state.abbr}>
                  <StateMarker state={state} onPress={guard(handleSelectStateMarker)} />
                </SilentMarkerBoundary>
              ))}
            {withCoords(mapMarkers, 'render markers').map((course) => (
              <SilentMarkerBoundary key={`${course.id}-${course.isFriend ? 'friend' : 'mine'}`}>
                <CourseMarker
                  course={course}
                  highlighted={selectedCourse?.id === course.id}
                  green={course.isMine || course.isFriend}
                  onPress={guard(handleSelectCourse)}
                />
              </SilentMarkerBoundary>
            ))}

            {feedFocusPin && (
              <SilentMarkerBoundary>
                <FeedFocusMarker pin={feedFocusPin} />
              </SilentMarkerBoundary>
            )}
          </MapView>
        </MapErrorBoundary>

        <ZoomControls onZoomIn={guard(handleZoomIn)} onZoomOut={guard(handleZoomOut)} />

        {selectedCourse && (
          <CoursePopupCard
            course={selectedCourse}
            detail={selectedDetail}
            onClose={clearSelectedCourse}
            onViewHoles={goToCourseDetail}
          />
        )}

        {feedCoursePopup && (
          <FeedCoursePopupCard course={feedCoursePopup} onViewHoles={goToCourseDetailFromFeedPopup} />
        )}
      </View>

      <Toast
        message={emptyMyCoursesToast}
        onHide={() => setEmptyMyCoursesToast(null)}
        duration={3000}
        bottom
      />
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
    flexWrap: 'wrap',
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
    minWidth: '60%',
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
  },
  friendBannerToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  friendBannerToggleLabel: {
    color: colors.offWhite,
    fontSize: 11,
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
  feedFocusMarker: {
    alignItems: 'center',
  },
  feedFocusLabel: {
    marginTop: -2,
    maxWidth: 160,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.red,
  },
  feedFocusLabelText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
