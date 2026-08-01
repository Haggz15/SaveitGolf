import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CourseSearchBar from '../components/map/CourseSearchBar';
import FriendSearchBar from '../components/map/FriendSearchBar';
import FilterPills from '../components/map/FilterPills';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import { MapWarningBanner, MapLoadingBanner } from '../components/map/MapMessageBanner';
import colors from '../theme/colors';
import { useCourseMapData, NORTHEAST_US_INITIAL_REGION } from '../hooks/useCourseMapData';
import { useAuth } from '../context/AuthContext';
import { getFriendPlayedCourses } from '../services/friendMap';

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
  const [friendFilter, setFriendFilter] = useState(null); // { username, courses, loading }
  const {
    setRegion,
    focusRegion,
    visibleStates,
    visibleCourses,
    geocodingStates,
    discovering,
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
    searchQuery,
    searchResults,
    searching,
    handleSearchQueryChange,
    clearSearch,
    handleSelectSearchResult,
  } = useCourseMapData({
    navigation,
    routeState: route?.params?.state,
    routeTimestamp: route?.params?.timestamp,
  });

  const initialZoom = useMemo(() => regionToZoom(NORTHEAST_US_INITIAL_REGION.latitudeDelta), []);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  useEffect(() => {
    if (!friendFilter || friendFilter.loading || friendFilter.courses.length === 0) return;
    const map = mapInstanceRef.current;
    if (!map) return;
    const bounds = friendFilter.courses.map((c) => [c.lat, c.lng]);
    map.fitBounds(bounds, { padding: [60, 60] });
  }, [friendFilter]);

  const handleSelectFriend = async (profile) => {
    clearSelectedCourse();
    setFriendFilter({ username: profile.username, courses: [], loading: true });
    try {
      const courses = await getFriendPlayedCourses(profile.user_id);
      setFriendFilter({ username: profile.username, courses, loading: false });
    } catch (err) {
      console.error('Failed to load friend played courses:', err);
      setFriendFilter({ username: profile.username, courses: [], loading: false });
    }
  };

  const handleClearFriendFilter = () => {
    setFriendFilter(null);
    clearSelectedCourse();
  };

  return (
    <View style={styles.screen}>
      <Header />
      <CourseSearchBar
        query={searchQuery}
        onChangeQuery={handleSearchQueryChange}
        onClear={clearSearch}
        results={searchResults}
        searching={searching}
        onSelectResult={handleSelectSearchResult}
      />
      <FriendSearchBar currentUserId={user?.id} onSelectFriend={handleSelectFriend} />
      <FilterPills value={filter} onChange={setFilter} />

      {friendFilter && (
        <View style={styles.friendBanner}>
          <Ionicons name="golf-outline" size={16} color={colors.white} />
          <Text style={styles.friendBannerText} numberOfLines={1}>
            {friendFilter.loading
              ? `Loading courses played by ${friendFilter.username}…`
              : friendFilter.courses.length > 0
              ? `Showing courses played by ${friendFilter.username}`
              : `${friendFilter.username} hasn't played any courses yet`}
          </Text>
          <TouchableOpacity onPress={handleClearFriendFilter} style={styles.friendBannerClear}>
            <Text style={styles.friendBannerClearText}>Clear</Text>
          </TouchableOpacity>
        </View>
      )}

      {locationDenied && (
        <MapWarningBanner icon="location-outline">
          Location permission denied — showing courses near the Northeast US instead.
        </MapWarningBanner>
      )}
      {quotaExceeded && (
        <MapWarningBanner icon="warning-outline">
          Daily course search limit reached — showing previously found courses only.
        </MapWarningBanner>
      )}

      <View style={styles.mapContainer}>
        <MapContainer
          center={[NORTHEAST_US_INITIAL_REGION.latitude, NORTHEAST_US_INITIAL_REGION.longitude]}
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

          <MapSync mapInstanceRef={mapInstanceRef} onRegionChange={setRegion} focusRegion={focusRegion} />

          {(friendFilter ? friendFilter.courses : visibleCourses).map((course) => (
            <Marker
              key={course.id}
              position={[course.lat, course.lng]}
              icon={selectedCourse?.id === course.id ? highlightedCourseIcon : courseIcon}
              zIndexOffset={selectedCourse?.id === course.id ? 1000 : 0}
              eventHandlers={{ click: () => handleSelectCourse(course) }}
            />
          ))}

          {userLocation && (
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

        <ZoomControls onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} />

        {(discovering || visibleStates.some((abbr) => geocodingStates[abbr])) && (
          <MapLoadingBanner>Finding courses…</MapLoadingBanner>
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
