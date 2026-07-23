import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';
import colors from '../theme/colors';
import { feedPosts, filterPills } from '../data/mockData';
import { HEADER_CONTENT_HEIGHT, PILL_ROW_HEIGHT, TAB_BAR_HEIGHT } from '../theme/layout';

function scoreLabel(score, par) {
  const diff = score - par;
  if (diff <= -2) return 'Eagle';
  if (diff === -1) return 'Birdie';
  if (diff === 0) return 'Par';
  if (diff === 1) return 'Bogey';
  return `+${diff}`;
}

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

  const toggleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
  };

  return (
    <View style={[styles.slide, { height }]}>
      <View style={styles.holeVisual}>
        <View style={styles.holeBadge}>
          <Text style={styles.holeBadgeNumber}>{post.hole}</Text>
          <Text style={styles.holeBadgeLabel}>HOLE</Text>
        </View>
        <Text style={styles.holeStatsText}>Par {post.par}</Text>
        <Text style={styles.scoreLabel}>{scoreLabel(post.score, post.par)}</Text>
      </View>

      <View style={styles.actionRail}>
        <TouchableOpacity style={styles.railButton} onPress={toggleLike}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={32}
            color={liked ? colors.red : colors.white}
          />
          <Text style={styles.railText}>{likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="chatbubble-outline" size={29} color={colors.white} />
          <Text style={styles.railText}>{post.comments}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.railButton}>
          <Ionicons name="share-outline" size={30} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomInfo}>
        <View style={styles.avatarRow}>
          <View style={styles.avatar} />
          <Text style={styles.username}>{post.user}</Text>
          <Text style={styles.timeAgo}>{post.timeAgo}</Text>
        </View>
        <Text style={styles.course}>{post.course}</Text>
        <Text style={styles.caption}>{post.caption}</Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  holeVisual: {
    alignItems: 'center',
  },
  holeBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  holeBadgeNumber: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 32,
    lineHeight: 36,
  },
  holeBadgeLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
  holeStatsText: {
    color: colors.offWhite,
    fontSize: 15,
    marginBottom: 6,
  },
  scoreLabel: {
    color: colors.gold,
    fontWeight: '700',
    fontSize: 22,
  },
  actionRail: {
    position: 'absolute',
    right: 14,
    bottom: 130,
    alignItems: 'center',
  },
  railButton: {
    alignItems: 'center',
    marginBottom: 22,
  },
  railText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  bottomInfo: {
    position: 'absolute',
    left: 16,
    right: 90,
    bottom: 60,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  course: {
    color: colors.offWhite,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  caption: {
    color: colors.offWhite,
    fontSize: 14,
    lineHeight: 20,
  },
  stateBadge: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(13, 31, 60, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(232, 236, 244, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
