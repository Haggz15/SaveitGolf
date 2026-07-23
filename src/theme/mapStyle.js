// Google Maps custom style (Android only — iOS uses Apple Maps' own dark
// mode via the MapView `userInterfaceStyle="dark"` prop). Slate/navy palette
// to match the app's dark theme and read like Apple Maps' dark style.
export const darkSlateMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#0d1f3c' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a93a8' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d1f3c' }] },
  {
    featureType: 'administrative',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#3c4a68' }],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#4a5a80' }],
  },
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#16294d' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#173023' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#24365a' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#16294d' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2e4368' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a93a8' }],
  },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a1730' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a5a80' }],
  },
];
