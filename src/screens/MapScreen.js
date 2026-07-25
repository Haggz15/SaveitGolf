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
import { useCourseMapData, US_INITIAL_REGION } from '../hooks/useCourseMapData';

const ZOOM_MIN_DELTA = 0.01;
const ZOOM_MAX_DELTA = US_INITIAL_REGION.latitudeDelta;

function CourseMarker({ course, onPress }) {
  return (
    <Marker
      coordinate={{ latitude: course.lat, longitude: course.lng }}
      onPress={() => onPress(course)}
      tracksViewChanges={false}
    >
      <Ionicons name="flag" size={28} color={colors.red} />
    </Marker>
  );
}

export default function MapScreen({ navigation, route }) {
  const mapRef = useRef(null);
  const {
    region,
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

      {locationDenied && (
        <MapWarningBanner icon="location-outline">
          Location permission denied — showing courses near the center of the US instead.
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
          {visibleCourses.map((course) => (
            <CourseMarker key={course.id} course={course} onPress={handleSelectCourse} />
          ))}
        </MapView>

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
  map: {
    flex: 1,
  },
});
