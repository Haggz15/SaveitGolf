import { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import FilterPills from '../components/map/FilterPills';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import { MapWarningBanner, MapLoadingBanner } from '../components/map/MapMessageBanner';
import colors from '../theme/colors';
import { darkSlateMapStyle } from '../theme/mapStyle';
import { stateCenters, allStateAbbreviations } from '../data/courses';
import { useCourseMapData, US_INITIAL_REGION, hasGoogleMapsKey } from '../hooks/useCourseMapData';

const ZOOM_MIN_DELTA = 0.01;
const ZOOM_MAX_DELTA = US_INITIAL_REGION.latitudeDelta;

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
      <Ionicons name="location" size={32} color={colors.green} />
    </Marker>
  );
}

export default function MapScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const {
    region,
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
  } = useCourseMapData({
    navigation,
    routeState: route?.params?.state,
    routeTimestamp: route?.params?.timestamp,
  });

  useEffect(() => {
    if (!focusRegion) return;
    mapRef.current?.animateToRegion(focusRegion, 600);
  }, [focusRegion]);

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
      <FilterPills value={filter} onChange={setFilter} />

      {!hasGoogleMapsKey && (
        <MapWarningBanner icon="warning-outline">
          {Platform.OS === 'android'
            ? 'Add GOOGLE_MAPS_API_KEY to .env for map tiles and course discovery on Android.'
            : 'Add GOOGLE_MAPS_API_KEY to .env to discover and geocode course pins.'}
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
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          userInterfaceStyle="dark"
          customMapStyle={Platform.OS === 'android' ? darkSlateMapStyle : undefined}
          initialRegion={US_INITIAL_REGION}
          showsUserLocation={!locationDenied}
          onRegionChangeComplete={setRegion}
        >
          {!isCourseTier &&
            allStateAbbreviations.map((abbr) => <StateMarker key={abbr} abbr={abbr} />)}

          {isCourseTier &&
            visibleCourses.map((course) => (
              <CourseMarker key={course.id} course={course} onPress={handleSelectCourse} />
            ))}
        </MapView>

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
});
