import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { MapContainer, TileLayer, Marker, CircleMarker, Tooltip, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CourseSearchBar from '../components/map/CourseSearchBar';
import FriendSearchBar from '../components/map/FriendSearchBar';
import FilterPills from '../components/map/FilterPills';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import MapErrorBoundary from '../components/map/MapErrorBoundary';
import SilentMarkerBoundary from '../components/map/SilentMarkerBoundary';
import { MapWarningBanner } from '../components/map/MapMessageBanner';
import Toast from '../components/Toast';
import colors from '../theme/colors';
import { useCourseMapData, US_INITIAL_REGION, MAP_FILTERS, ZOOM_LEVEL } from '../hooks/useCourseMapData';
import { useAuth } from '../context/AuthContext';
import { getFriendMyCourses } from '../services/friendMap';
import { filterCoursesWithValidCoordinates, hasValidCoordinates } from '../utils/mapCoords';

// react-native-maps has no web renderer, so web gets its own map surface here
// (react-leaflet + dark CARTO tiles) driven by the same useCourseMapData hook
// that MapScreen.js (iOS/Android) uses, so course data, discovery, and the
// filter/popup/zoom behavior stay identical across platforms.

const PIN_SIZE = 30;
const HIGHLIGHTED_PIN_SIZE = 42;
const FLAG_POLE_X = 8;
// Golf flag-on-a-pole, drawn as an SVG divIcon since Leaflet markers render
// outside React's tree and can't host RN/Ionicons directly. `highlighted`
// draws a larger flag with a glow ring behind it, used for the pin dropped
// when a search result is selected so it stands out from the rest.
function buildFlagIcon(color, size = PIN_SIZE, highlighted = false) {
  const halo = highlighted
    ? `<circle cx="15" cy="15" r="14" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="1.5"/>`
    : '';
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg">
    ${halo}
    <line x1="${FLAG_POLE_X}" y1="2" x2="${FLAG_POLE_X}" y2="28" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
    <path d="M${FLAG_POLE_X} 3 L25 9 L${FLAG_POLE_X} 15 Z" fill="${color}" stroke="#ffffff" stroke-width="1" stroke-linejoin="round"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'saveitgolf-course-pin',
    iconSize: [size, size],
    iconAnchor: [(FLAG_POLE_X * size) / PIN_SIZE, ((PIN_SIZE - 2) * size) / PIN_SIZE],
  });
}

const courseIcon = buildFlagIcon(colors.red);
const highlightedCourseIcon = buildFlagIcon(colors.red, HIGHLIGHTED_PIN_SIZE, true);
// The pin dropped when a course name is tapped from the feed (see
// useCourseMapData's routeZoomToState handling) — 1.5x a normal course pin,
// with the course name shown via Leaflet's permanent Tooltip so it's always
// visible rather than needing a click to reveal.
const FEED_FOCUS_PIN_SIZE = Math.round(PIN_SIZE * 1.5);
const feedFocusIcon = buildFlagIcon(colors.red, FEED_FOCUS_PIN_SIZE);

// Teardrop push-pin (not a flag) used for the user's own My Courses list —
// the map's default view — so those pins read distinctly from the red flag
// used for search results and course-detail "View on Map" focus.
function buildPushPinIcon(color, size = PIN_SIZE) {
  const svg = `<svg width="${size}" height="${size}" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.75 17 27 17 27s17-14.25 17-27C34 7.6 26.4 0 17 0z" fill="${color}" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="17" cy="17" r="6.5" fill="${colors.navy}"/>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'saveitgolf-course-pin',
    iconSize: [size, (size * 44) / 34],
    iconAnchor: [size / 2, (size * 44) / 34],
  });
}

const greenCourseIcon = buildPushPinIcon(colors.green);

// Level 1 (zoomed-out full-US) pin — a green push pin, larger than a course
// flag pin, with the state abbreviation on a small label underneath. Built
// once per abbreviation since Leaflet markers render outside React's tree.
const STATE_PIN_WIDTH = 34;
const STATE_PIN_HEIGHT = 50;
function buildStatePushPinIcon(abbr) {
  const fill = colors.green;
  const svg = `<svg width="${STATE_PIN_WIDTH}" height="${STATE_PIN_HEIGHT}" viewBox="0 0 34 50" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2C7.6 2 0 9.6 0 19c0 12.75 17 25 17 25s17-12.25 17-25C34 9.6 26.4 2 17 2z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="17" cy="19" r="6.5" fill="${colors.navy}"/>
    <rect x="0" y="34" width="34" height="16" rx="4" fill="${colors.navy}" stroke="${fill}" stroke-width="1.5"/>
    <text x="17" y="45.5" font-family="sans-serif" font-size="12" font-weight="800" fill="#ffffff" text-anchor="middle">${abbr}</text>
  </svg>`;
  return L.divIcon({
    html: svg,
    className: 'saveitgolf-state-pin',
    iconSize: [STATE_PIN_WIDTH, STATE_PIN_HEIGHT],
    iconAnchor: [17, STATE_PIN_HEIGHT - 2],
  });
}

// Leaflet fires marker/map event handlers outside React's render cycle —
// an error thrown inside one doesn't hit a React error boundary the normal
// way and can leave Leaflet's internal event dispatch in a broken state.
// Catching and logging here keeps a bad tap from freezing the map.
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
// rendering one with a null/NaN/out-of-range position crashes react-leaflet,
// so it's filtered out here as a last line of defense and logged (courses
// are already filtered when loaded in useCourseMapData, but this keeps the
// map safe against any other source of course data too, e.g. friendFilter).
function withCoords(courses, context) {
  return filterCoursesWithValidCoordinates(courses, context);
}

function regionToZoom(latitudeDelta) {
  return Math.min(18, Math.max(2, Math.round(Math.log2(360 / latitudeDelta))));
}

function boundsToRegion(map) {
  const bounds = map.getBounds();
  const center = map.getCenter();
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta: bounds.getNorth() - bounds.getSouth(),
    longitudeDelta: bounds.getEast() - bounds.getWest(),
  };
}

// Bridges Leaflet's imperative map instance to the platform-agnostic hook:
// reports viewport changes up, and reacts to focus requests (initial user
// location fix, or a state jumped to from the feed) coming down.
function MapSync({ mapInstanceRef, onRegionChange, focusRegion }) {
  const map = useMapEvents({
    moveend: () => onRegionChange(boundsToRegion(map)),
  });

  useEffect(() => {
    mapInstanceRef.current = map;
    onRegionChange(boundsToRegion(map));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    if (!focusRegion) return;
    map.flyTo([focusRegion.latitude, focusRegion.longitude], regionToZoom(focusRegion.latitudeDelta), {
      duration: 0.6,
    });
  }, [focusRegion, map]);

  return null;
}

export default function MapScreen({ navigation, route }) {
  const { user } = useAuth();
  const mapInstanceRef = useRef(null);
  const [friendFilter, setFriendFilter] = useState(null); // { displayName, courses, loading }
  const [emptyMyCoursesToast, setEmptyMyCoursesToast] = useState(null);
  const playedEmptyToastShownRef = useRef(false);
  const {
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
    feedFocusPin,
    filter,
    setFilter,
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
  } = useCourseMapData({
    navigation,
    routeFocusCourse: route?.params?.focusCourse,
    routeTimestamp: route?.params?.timestamp,
    routeZoomToState: route?.params?.zoomToState,
    routeZoomToStateTimestamp: route?.params?.zoomToStateAt,
    userId: user?.id,
  });

  // The Map tab stays mounted across tab switches, so a course added on the
  // Profile tab wouldn't otherwise show up here until the app reloads.
  // Refetching my_courses every time this screen regains focus keeps it in
  // sync without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      console.log('[MapScreen.web] screen focused — refreshing my_courses');
      refreshMyCourses();
    }, [refreshMyCourses])
  );

  const initialZoom = useMemo(() => regionToZoom(US_INITIAL_REGION.latitudeDelta), []);
  const stateIcons = useMemo(
    () =>
      Object.fromEntries(
        stateMarkers
          .map((state) => {
            try {
              return [state.abbr, buildStatePushPinIcon(state.abbr)];
            } catch (err) {
              console.error(`[MapScreen] failed to build pin icon for state "${state.abbr}":`, err);
              return null;
            }
          })
          .filter(Boolean)
      ),
    [stateMarkers]
  );

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  useEffect(() => {
    if (!friendFilter || friendFilter.loading || friendFilter.courses.length === 0) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = friendFilter.courses.map((c) => [c.lat, c.lng]);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [friendFilter]);

  // My Courses pins are now a permanent layer (see useCourseMapData), so
  // this fits the map to them once, the first time they load — not on
  // every refetch (refreshMyCourses reruns on every tab focus, which would
  // otherwise re-snap the map and undo the user's own panning/zooming every
  // time they revisit the Map tab).
  const hasFitMyCoursesRef = useRef(false);
  useEffect(() => {
    if (myCoursesLoading || myCoursesList.length === 0 || hasFitMyCoursesRef.current) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    hasFitMyCoursesRef.current = true;
    const bounds = myCoursesList.map((c) => [c.lat, c.lng]);
    map.fitBounds(bounds, { padding: [60, 60] });
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

      <style>{`
        .saveitgolf-feed-focus-tooltip {
          background: ${colors.navyCard};
          color: ${colors.white};
          border: 1px solid ${colors.red};
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          box-shadow: none;
        }
        .saveitgolf-feed-focus-tooltip::before {
          border-top-color: ${colors.red};
        }
      `}</style>

      <View style={styles.mapContainer}>
        <MapErrorBoundary>
          <MapContainer
            center={[US_INITIAL_REGION.latitude, US_INITIAL_REGION.longitude]}
            zoom={initialZoom}
            zoomControl={false}
            style={styles.map}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxZoom={20}
              attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />

            <MapSync mapInstanceRef={mapInstanceRef} onRegionChange={guard(setRegion)} focusRegion={focusRegion} />

            {!friendFilter &&
              filter !== MAP_FILTERS.PLAYED &&
              zoomLevel === ZOOM_LEVEL.COUNTRY &&
              stateMarkers.map((state) => (
                <SilentMarkerBoundary key={state.abbr}>
                  <Marker
                    position={[state.lat, state.lng]}
                    icon={stateIcons[state.abbr]}
                    eventHandlers={{ click: guard(() => handleSelectStateMarker(state.abbr)) }}
                  />
                </SilentMarkerBoundary>
              ))}
            {withCoords(friendFilter ? friendFilter.courses : visibleCourses, 'render markers').map((course) => {
              const isHighlighted = selectedCourse?.id === course.id;
              const isGreen = !friendFilter && course.isMine;
              return (
                <SilentMarkerBoundary key={course.id}>
                  <Marker
                    position={[course.lat, course.lng]}
                    icon={isHighlighted ? highlightedCourseIcon : isGreen ? greenCourseIcon : courseIcon}
                    zIndexOffset={isHighlighted ? 1000 : 0}
                    eventHandlers={{ click: guard(() => handleSelectCourse(course)) }}
                  />
                </SilentMarkerBoundary>
              );
            })}

            {feedFocusPin && (
              <SilentMarkerBoundary>
                <Marker position={[feedFocusPin.lat, feedFocusPin.lng]} icon={feedFocusIcon} zIndexOffset={1500}>
                  <Tooltip permanent direction="top" offset={[0, -FEED_FOCUS_PIN_SIZE + 4]} className="saveitgolf-feed-focus-tooltip">
                    {feedFocusPin.name}
                  </Tooltip>
                </Marker>
              </SilentMarkerBoundary>
            )}

            {userLocation && hasValidCoordinates(userLocation.latitude, userLocation.longitude) && (
              <>
                <CircleMarker
                  center={[userLocation.latitude, userLocation.longitude]}
                  radius={14}
                  pathOptions={{ color: 'transparent', fillColor: '#4A90E2', fillOpacity: 0.2 }}
                />
                <CircleMarker
                  center={[userLocation.latitude, userLocation.longitude]}
                  radius={7}
                  pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#4A90E2', fillOpacity: 1 }}
                />
              </>
            )}
          </MapContainer>
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
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.navy,
  },
});
