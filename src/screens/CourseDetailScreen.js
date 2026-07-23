import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { getCourseById } from '../services/golfCourseApi';

export default function CourseDetailScreen({ route, navigation }) {
  const { courseId, courseName, city, state } = route.params ?? {};
  const [tees, setTees] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!courseId) {
      setLoading(false);
      setError('No course selected.');
      return;
    }
    getCourseById(courseId)
      .then((course) => {
        if (cancelled) return;
        setTees(course.tees ?? null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const primaryTee = tees?.male?.[0] ?? tees?.female?.[0] ?? null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {courseName ?? 'Course'}
          </Text>
          <Text style={styles.subtitle}>
            {city ? `${city}, ${state}` : state}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading && (
          <View style={styles.centerBlock}>
            <ActivityIndicator color={colors.red} />
            <Text style={styles.loadingText}>Loading holes & shots…</Text>
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBlock}>
            <Ionicons name="alert-circle-outline" size={28} color={colors.muted} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && primaryTee && (
          <>
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{primaryTee.par_total}</Text>
                <Text style={styles.summaryLabel}>Par</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{primaryTee.total_yards}</Text>
                <Text style={styles.summaryLabel}>Yards</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{primaryTee.course_rating}</Text>
                <Text style={styles.summaryLabel}>Rating</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{primaryTee.slope_rating}</Text>
                <Text style={styles.summaryLabel}>Slope</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Holes ({primaryTee.tee_name} tees)</Text>
            {primaryTee.holes.map((hole, index) => (
              <View key={index} style={styles.holeRow}>
                <Text style={styles.holeNumber}>{index + 1}</Text>
                <Text style={styles.holeCell}>Par {hole.par}</Text>
                <Text style={styles.holeCell}>{hole.yardage} yds</Text>
                <Text style={styles.holeCellMuted}>Hcp {hole.handicap}</Text>
              </View>
            ))}

            <View style={styles.shotsPlaceholder}>
              <Ionicons name="camera-outline" size={22} color={colors.muted} />
              <Text style={styles.shotsPlaceholderText}>
                No shots posted for this course yet
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  },
  title: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centerBlock: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: colors.muted,
    marginTop: 10,
    fontSize: 13,
  },
  errorText: {
    color: colors.muted,
    marginTop: 10,
    fontSize: 13,
    textAlign: 'center',
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: colors.navyCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingVertical: 16,
    marginBottom: 20,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
    marginBottom: 10,
  },
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  holeNumber: {
    color: colors.gold,
    fontWeight: '800',
    width: 28,
  },
  holeCell: {
    color: colors.offWhite,
    fontSize: 13,
    width: 80,
  },
  holeCellMuted: {
    color: colors.muted,
    fontSize: 12,
  },
  shotsPlaceholder: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  shotsPlaceholderText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
  },
});
