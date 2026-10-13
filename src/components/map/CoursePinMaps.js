import { useRef } from 'react';
import { Platform, StyleSheet } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import colors from '../../theme/colors';
import { darkSlateMapStyle } from '../../theme/mapStyle';

// The two map surfaces behind a hand-typed course's location on the Course
// Detail screen (iOS/Android — see CoursePinMaps.web.js for web). `center`
// is { lat, lng }; `zoomedIn` frames a placed pin closely, otherwise the
// map shows a whole state.

const PIN_DELTA = 0.02;
const STATE_DELTA = 6;

function toRegion({ lat, lng }, zoomedIn) {
  const delta = zoomedIn ? PIN_DELTA : STATE_DELTA;
  return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
}

const mapProps = {
  provider: Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined,
  userInterfaceStyle: 'dark',
  customMapStyle: Platform.OS === 'android' ? darkSlateMapStyle : undefined,
};

// Static preview: shows the pin when there is one, otherwise just the state.
export function PinPreviewMap({ center, pin, style }) {
  return (
    <MapView
      {...mapProps}
      style={[styles.map, style]}
      region={toRegion(pin ?? center, !!pin)}
      scrollEnabled={false}
      zoomEnabled={false}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
    >
      {pin && <Marker coordinate={{ latitude: pin.lat, longitude: pin.lng }} pinColor={colors.red} />}
    </MapView>
  );
}

// Full-screen pannable map for pin placement mode. Reports the map's center
// after every pan/zoom — the caller overlays a fixed pin on that center.
export function PinPlacementMap({ initialCenter, zoomedIn, onCenterChange }) {
  // initialRegion is only read on mount; keep it stable across re-renders.
  const initialRegion = useRef(toRegion(initialCenter, zoomedIn)).current;
  return (
    <MapView
      {...mapProps}
      style={styles.map}
      initialRegion={initialRegion}
      rotateEnabled={false}
      pitchEnabled={false}
      toolbarEnabled={false}
      onRegionChangeComplete={(r) => onCenterChange({ lat: r.latitude, lng: r.longitude })}
    />
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
