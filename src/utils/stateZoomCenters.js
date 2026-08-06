import stateCapitals from '../data/stateCapitals.json';

// The feed's "tap a course name" flow zooms the map out to show the whole
// state a course is in. Five high-traffic states use explicitly specified
// centers (not the same as stateCenters.json's geographic centroids, and not
// their capitals either — these were given directly); every other state
// falls back to its capital's coordinates.
const STATE_ZOOM_OVERRIDES = {
  PA: { lat: 40.9, lng: -77.8 },
  NY: { lat: 42.9, lng: -75.5 },
  CA: { lat: 36.7, lng: -119.4 },
  FL: { lat: 27.9, lng: -81.6 },
  TX: { lat: 31.0, lng: -100.0 },
};

export const STATE_ZOOM_LEVEL = 7;

export function getStateZoomCenter(stateAbbr) {
  if (!stateAbbr) return null;
  const abbr = stateAbbr.toUpperCase();
  return STATE_ZOOM_OVERRIDES[abbr] || stateCapitals[abbr] || null;
}

// react-native-maps has no direct "zoom level" concept — it works off region
// deltas — so a requested zoom level is converted the same way MapScreen.web
// converts a Leaflet zoom back to a region (regionToZoom does the inverse:
// Math.log2(360 / latitudeDelta)).
export function zoomLevelToDelta(zoom) {
  return 360 / Math.pow(2, zoom);
}
