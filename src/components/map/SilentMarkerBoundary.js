import { Component } from 'react';

// Wraps a single marker/layer so if it throws while mounting (a bad icon,
// an edge-case coordinate that slipped past validation, etc.) only that one
// marker disappears — logged, not shown to the user — instead of the error
// bubbling up and taking down every other marker and the map itself.
export default class SilentMarkerBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error('[SilentMarkerBoundary] skipped a marker that failed to render:', error);
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
