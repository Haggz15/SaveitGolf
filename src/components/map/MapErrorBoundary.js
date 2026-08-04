import { Component } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

// The map surface (react-native-maps / react-leaflet + their marker layers)
// can throw during commit — e.g. a third-party marker projecting a bad
// lat/lng — outside of any try/catch we control. Catching that here keeps
// it from taking down the whole app: the rest of the screen (search bar,
// filters, tab bar) stays interactive and the user can retry the map alone.
export default class MapErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('[MapErrorBoundary] map crashed:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="warning-outline" size={28} color={colors.muted} />
          <Text style={styles.title}>The map couldn't load</Text>
          <Text style={styles.subtitle}>Something went wrong showing the course map.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry} activeOpacity={0.85}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
    padding: 24,
    gap: 8,
  },
  title: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.red,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
