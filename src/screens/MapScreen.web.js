import { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from '../components/Header';
import FilterPills from '../components/map/FilterPills';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import { MapWarningBanner, MapLoadingBanner } from '../components/map/MapMessageBanner';
import colors from '../theme/colors';
import { stateCenters, allStateAbbreviations } from '../data/courses';
import { useCourseMapData, US_INITIAL_REGION, hasGoogleMapsKey } from '../hooks/useCourseMapData';

// react-native-maps has no web renderer, so web gets its own map surface here
// (react-leaflet + dark CARTO tiles) driven by the same useCourseMapData hook
// that MapScreen.js (iOS/Android) uses, so course data, discovery, and the
// filter/popup/zoom behavior stay identical across platforms.

const PIN_SIZE = 30;
// Classic teardrop map-pin path, drawn as an SVG divIcon since Leaflet
// markers render outside React's tree and can't host RN/Ionicons directly.
const PIN_PATH =
  'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z';

function buildPinIcon(color) {
  const svg = `<svg width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" stroke="#ffffff" stroke-width="1" d="${PIN_PATH}"/></svg>`;
  return L.divIcon({
    html: svg,
    className: 'saveitgolf-course-pin',
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE],
  });
}

const STATE_ICON_SIZE = 30;
const stateIcon = L.divIcon({
  html: `<div style="width:${STATE_ICON_SIZE}px;height:${STATE_ICON_SIZE}px;border-radius:${STATE_ICON_SIZE / 2}px;background:${colors.red};border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-size:14px;">⛳</div>`,
  className: 'saveitgolf-state-pin',
  iconSize: [STATE_ICON_SIZE, STATE_ICON_SIZE],
  iconAnchor: [STATE_ICON_SIZE / 2, STATE_ICON_SIZE / 2],
});

const courseIcon = buildPinIcon(colors.green);

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
  const mapInstanceRef = useRef(null);
  const {
    setRegion,
    focusRegion,
    isCourseTier,
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
  } = useCourseMapData({
    navigation,
    routeState: route?.params?.state,
    routeTimestamp: route?.params?.timestamp,
  });

  const initialZoom = useMemo(() => regionToZoom(US_INITIAL_REGION.latitudeDelta), []);

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn();
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut();

  return (
    <View style={styles.screen}>
      <Header />
      <FilterPills value={filter} onChange={setFilter} />

      {!hasGoogleMapsKey && (
        <MapWarningBanner icon="warning-outline">
          Add GOOGLE_MAPS_API_KEY to .env to discover and geocode course pins.
        </MapWarningBanner>
      )}
      {hasGoogleMapsKey && locationDenied && (
        <MapWarningBanner icon="location-outline">
          Location permission denied — showing the national view instead of courses near you.
        </MapWarningBanner>
      )}
      {quotaExceeded && (
        <MapWarningBanner icon="warning-outline">
          Daily course search limit reached — showing previously found courses only.
        </MapWarningBanner>
      )}

      <View style={styles.mapContainer}>
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

          <MapSync mapInstanceRef={mapInstanceRef} onRegionChange={setRegion} focusRegion={focusRegion} />

          {!isCourseTier &&
            allStateAbbreviations.map((abbr) => {
              const center = stateCenters[abbr];
              return <Marker key={abbr} position={[center.lat, center.lng]} icon={stateIcon} />;
            })}

          {isCourseTier &&
            visibleCourses.map((course) => (
              <Marker
                key={course.id}
                position={[course.lat, course.lng]}
                icon={courseIcon}
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

        {(discovering || (isCourseTier && visibleStates.some((abbr) => geocodingStates[abbr]))) && (
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
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: colors.navy,
  },
});
