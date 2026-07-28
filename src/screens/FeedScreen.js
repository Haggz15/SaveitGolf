import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ImageBackground, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Header from '../components/Header';
import colors from '../theme/colors';
import { feedPosts, filterPills } from '../data/mockData';
import { HEADER_CONTENT_HEIGHT, PILL_ROW_HEIGHT, TAB_BAR_HEIGHT } from '../theme/layout';

function FilterPill({ label, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.pill, active && styles.pillActive]}
    >
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PostSlide({ post, height, onStatePress }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <ImageBackground source={post.image} style={[styles.slide, { height }]} resizeMode="cover">
      <View style={styles.dimOverlay} />

      <LinearGradient
        colors={['transparent', 'rgba(6, 14, 26, 0.94)']}
        locations={[0, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      <View style={styles.holeVisual}>
        <View style={styles.holeBadge}>
          <Text style={styles.holeBadgeNumber}>{post.hole}</Text>
          <Text style={styles.holeBadgeLabel}>HOLE</Text>
        </View>
        <Text style={styles.holeStatsText}>Par {post.par}</Text>
      </View>

      <View style={styles.actionRail}>
        <TouchableOpacity style={styles.railButton} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={34}
            color={liked ? colors.red : colors.white}
          />
          <Text style={styles.railText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="chatbubble-outline" size={31} color={colors.white} />
          <Text style={styles.railText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="share-outline" size={32} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton} onPress={() => setSaved((prev) => !prev)}>
          <Ionicons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={30}
            color={colors.white}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.leftInfo}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar} />
          <Text style={styles.username}>{post.user}</Text>
          <Text style={styles.timeAgo}>{post.timeAgo}</Text>
        </View>
        <Text style={styles.caption} numberOfLines={2} ellipsizeMode="tail">
          {post.caption}
        </Text>
      </View>

      <View style={styles.courseRow}>
        <TouchableOpacity
          style={styles.stateBadge}
          onPress={() => onStatePress(post)}
          activeOpacity={0.7}
        >
          <Text style={styles.stateBadgeText}>{post.state}</Text>
        </TouchableOpacity>

        <Text style={styles.courseName} numberOfLines={1} ellipsizeMode="tail">
          {post.course}
        </Text>
      </View>
    </ImageBackground>
  );
}

export default function FeedScreen({ navigation }) {
  const [activeFilter, setActiveFilter] = useState('Following');
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const containerHeight =
    windowHeight - insets.top - HEADER_CONTENT_HEIGHT - PILL_ROW_HEIGHT - TAB_BAR_HEIGHT;

  const handleStatePress = (post) => {
    navigation.navigate('Map', {
      state: post.state,
      timestamp: Date.now(),
    });
  };

  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.pillRow}>
        <FlatList
          data={filterPills}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => (
            <FilterPill
              label={item}
              active={activeFilter === item}
              onPress={() => setActiveFilter(item)}
            />
          )}
        />
      </View>

      <View style={styles.pagerContainer}>
        {containerHeight > 0 && (
          <FlatList
            data={feedPosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostSlide post={item} height={containerHeight} onStatePress={handleStatePress} />
            )}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={containerHeight}
            snapToAlignment="start"
            getItemLayout={(_, index) => ({
              length: containerHeight,
              offset: containerHeight * index,
              index,
            })}
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
  pillRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
    zIndex: 2,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.navyCard,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  pillActive: {
    backgroundColor: colors.red,
    borderColor: colors.red,
  },
  pillText: {
    color: colors.muted,
    fontWeight: '600',
    fontSize: 13,
  },
  pillTextActive: {
    color: colors.white,
  },
  pagerContainer: {
    flex: 1,
  },
  slide: {
    width: '100%',
    backgroundColor: colors.navyLight,
    position: 'relative',
    overflow: 'hidden',
  },
  dimOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 26, 0.15)',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '55%',
  },
  holeVisual: {
    position: 'absolute',
    top: 12,
    right: 14,
    alignItems: 'center',
  },
  holeBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.red,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  holeBadgeNumber: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 24,
    lineHeight: 27,
  },
  holeBadgeLabel: {
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 1,
  },
  holeStatsText: {
    color: colors.offWhite,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    backgroundColor: 'rgba(6, 14, 26, 0.55)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  actionRail: {
    position: 'absolute',
    right: 14,
    bottom: 120,
    alignItems: 'center',
  },
  railButton: {
    alignItems: 'center',
    marginBottom: 20,
  },
  railText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  leftInfo: {
    position: 'absolute',
    left: 16,
    right: 90,
    bottom: 68,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.navyBorder,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  username: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    marginRight: 8,
  },
  timeAgo: {
    color: colors.muted,
    fontSize: 12,
  },
  caption: {
    color: colors.offWhite,
    fontSize: 13,
    lineHeight: 18,
  },
  courseRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: 'rgba(13, 31, 60, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(232, 236, 244, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stateBadgeText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  courseName: {
    flexShrink: 1,
    color: '#ffffff',
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    letterSpacing: 0.8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
