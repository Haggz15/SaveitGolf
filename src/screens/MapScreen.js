import { useEffect, useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import CourseSearchBar from '../components/map/CourseSearchBar';
import FilterPills from '../components/map/FilterPills';
import ZoomControls from '../components/map/ZoomControls';
import CoursePopupCard from '../components/map/CoursePopupCard';
import { MapWarningBanner, MapLoadingBanner } from '../components/map/MapMessageBanner';
import colors from '../theme/colors';
import { darkSlateMapStyle } from '../theme/mapStyle';
import { useCourseMapData, NORTHEAST_US_INITIAL_REGION, MAX_MAP_DELTA } from '../hooks/useCourseMapData';

const ZOOM_MIN_DELTA = 0.01;
const ZOOM_MAX_DELTA = MAX_MAP_DELTA;

function CourseMarker({ course, highlighted, onPress }) {
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
        <Ionicons name="flag" size={28} color={colors.red} />
      )}
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
      <CourseSearchBar
        query={searchQuery}
        onChangeQuery={handleSearchQueryChange}
        onClear={clearSearch}
        results={searchResults}
        searching={searching}
        onSelectResult={handleSelectSearchResult}
      />
      <FilterPills value={filter} onChange={setFilter} />

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
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          userInterfaceStyle="dark"
          customMapStyle={Platform.OS === 'android' ? darkSlateMapStyle : undefined}
          initialRegion={NORTHEAST_US_INITIAL_REGION}
          showsUserLocation={!locationDenied}
          onRegionChangeComplete={setRegion}
        >
          {visibleCourses.map((course) => (
            <CourseMarker
              key={course.id}
              course={course}
              highlighted={selectedCourse?.id === course.id}
              onPress={handleSelectCourse}
            />
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
