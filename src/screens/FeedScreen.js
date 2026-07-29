import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
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

function VideoBackground({ source, muted }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  return (
    <VideoView
      player={player}
      style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ enable: false }}
      playsInline
    />
  );
}

function PostSlide({ post, height, onStatePress }) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [saved, setSaved] = useState(false);
  const [muted, setMuted] = useState(true);
  const isVideo = !!post.video;

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <View style={[styles.slide, { height }]}>
      {isVideo ? (
        <VideoBackground source={post.video} muted={muted} />
      ) : (
        <Image
          source={post.image}
          style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
          resizeMode="cover"
        />
      )}

      <View style={styles.dimOverlay} />

      <LinearGradient
        colors={['transparent', 'rgba(6, 14, 26, 0.94)']}
        locations={[0, 1]}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {isVideo && (
        <TouchableOpacity
          style={styles.soundToggle}
          onPress={() => setMuted((prev) => !prev)}
          activeOpacity={0.7}
        >
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color={colors.white} />
        </TouchableOpacity>
      )}

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

      <Text style={styles.courseName} numberOfLines={1} ellipsizeMode="tail">
        {post.course}
      </Text>

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

      <TouchableOpacity
        style={styles.stateBadge}
        onPress={() => onStatePress(post)}
        activeOpacity={0.7}
      >
        <Text style={styles.stateBadgeText}>{post.state}</Text>
      </TouchableOpacity>
    </View>
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
  soundToggle: {
    position: 'absolute',
    top: 12,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(6, 14, 26, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
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
  courseName: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 80,
    color: '#ffffff',
    fontFamily: 'Cinzel_700Bold',
    fontSize: 15,
    letterSpacing: 0.6,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  leftInfo: {
    position: 'absolute',
    left: 16,
    right: 60,
    bottom: 14,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.navyBorder,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  username: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 12,
    marginRight: 8,
  },
  timeAgo: {
    color: colors.muted,
    fontSize: 10,
  },
  caption: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
  },
  stateBadge: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(6, 14, 26, 0.65)',
  },
  stateBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
