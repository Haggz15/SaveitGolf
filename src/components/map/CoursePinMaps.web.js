import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import colors from '../../theme/colors';

// Web counterpart of CoursePinMaps.js — react-native-maps has no web
// renderer, so these use react-leaflet with the same dark CARTO tiles as
// MapScreen.web.js.

const PIN_ZOOM = 15;
const STATE_ZOOM = 6;

const pinIcon = L.divIcon({
  html: `<svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 1C7 1 1.5 6.5 1.5 13.3 1.5 22.5 14 35 14 35s12.5-12.5 12.5-21.7C26.5 6.5 21 1 14 1z" fill="${colors.red}" stroke="#ffffff" stroke-width="1.5"/>
    <circle cx="14" cy="13" r="4.5" fill="#ffffff"/>
  </svg>`,
  className: 'saveitgolf-course-location-pin',
  iconSize: [28, 36],
  iconAnchor: [14, 35],
});

function Tiles() {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      subdomains="abcd"
      maxZoom={20}
      attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    />
  );
}

// Leaflet measures its container once on mount; inside a Modal that
// happens before layout settles, leaving grey untiled areas.
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const id = setTimeout(() => map.invalidateSize(), 0);
    return () => clearTimeout(id);
  }, [map]);
  return null;
}

function CenterReporter({ onCenterChange }) {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter();
      onCenterChange({ lat: c.lat, lng: c.lng });
    },
  });
  return null;
}

export function PinPreviewMap({ center, pin, style }) {
  const view = pin ?? center;
  return (
    <View style={[styles.map, style]}>
      {/* MapContainer ignores prop changes after mount — remount on a new view. */}
      <MapContainer
        key={`${view.lat},${view.lng},${!!pin}`}
        center={[view.lat, view.lng]}
        zoom={pin ? PIN_ZOOM : STATE_ZOOM}
        zoomControl={false}
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
        style={styles.leaflet}
      >
        <Tiles />
        {pin && <Marker position={[pin.lat, pin.lng]} icon={pinIcon} interactive={false} />}
      </MapContainer>
    </View>
  );
}

export function PinPlacementMap({ initialCenter, zoomedIn, onCenterChange }) {
  return (
    <View style={styles.map}>
      <MapContainer
        center={[initialCenter.lat, initialCenter.lng]}
        zoom={zoomedIn ? PIN_ZOOM : STATE_ZOOM}
        zoomControl={false}
        style={styles.leaflet}
      >
        <Tiles />
        <InvalidateSizeOnMount />
        <CenterReporter onCenterChange={onCenterChange} />
      </MapContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  leaflet: {
    height: '100%',
    width: '100%',
  },
});
