import { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { getFollowersList, getFollowingList, getFollowingIds, followUser, unfollowUser } from '../../services/social';

function getInitials(fullName) {
  if (!fullName) return '';
  return fullName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function UserRow({ user, isFollowing, isSelf, busy, onPress, onToggleFollow }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.avatar}>
        {user.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={styles.avatarImage} />
        ) : (
          <Text style={styles.avatarInitials}>{getInitials(user.full_name)}</Text>
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.fullName} numberOfLines={1}>
          {user.full_name || 'Golfer'}
        </Text>
        <Text style={styles.username} numberOfLines={1}>
          {user.username ? `@${user.username}` : ''}
        </Text>
      </View>
      {!isSelf && (
        <TouchableOpacity
          style={[styles.followButton, isFollowing && styles.followingButton]}
          onPress={onToggleFollow}
          disabled={busy}
          hitSlop={8}
          activeOpacity={0.8}
        >
          <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
            {isFollowing ? 'Unfollow' : 'Follow'}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// Full-screen Followers/Following list — `profileUserId` is whose list is
// being shown, `currentUserId` is the signed-in viewer (used to work out
// which rows already show "Following" vs "Follow", and to hide the button on
// the viewer's own row). Reused for both stats on ProfileScreen; `mode`
// switches the query, title, and empty-state copy.
export default function FollowListModal({ visible, mode, profileUserId, currentUserId, onClose, navigation, onFollowChange }) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [busyUserId, setBusyUserId] = useState(null);

  const load = useCallback(async () => {
    if (!profileUserId) return;
    setLoading(true);
    try {
      const [list, myFollowingIds] = await Promise.all([
        mode === 'followers' ? getFollowersList(profileUserId) : getFollowingList(profileUserId),
        currentUserId ? getFollowingIds(currentUserId) : Promise.resolve([]),
      ]);
      setUsers(list);
      setFollowingIds(new Set(myFollowingIds));
    } catch (err) {
      console.error(`Failed to load ${mode} list:`, err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [mode, profileUserId, currentUserId]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  async function handleToggleFollow(targetUserId) {
    if (!currentUserId || busyUserId) return;
    const isFollowing = followingIds.has(targetUserId);
    setBusyUserId(targetUserId);
    try {
      if (isFollowing) {
        await unfollowUser(currentUserId, targetUserId);
      } else {
        await followUser(currentUserId, targetUserId);
      }
      await load();
      onFollowChange?.();
    } catch (err) {
      console.error('Failed to update follow status:', err);
    } finally {
      setBusyUserId(null);
    }
  }

  function handlePressUser(user) {
    if (!user.username) return;
    onClose();
    navigation.navigate('UserProfile', { username: user.username });
  }

  const title = mode === 'followers' ? 'Followers' : 'Following';
  const emptyText = mode === 'followers' ? 'No followers yet' : 'Not following anyone yet';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {loading ? title : `${users.length} ${title}`}
          </Text>
          <View style={styles.closeButton} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.red} size="large" style={{ marginTop: 40 }} />
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>{emptyText}</Text>
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.user_id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <UserRow
                user={item}
                isFollowing={followingIds.has(item.user_id)}
                isSelf={item.user_id === currentUserId}
                busy={busyUserId === item.user_id}
                onPress={() => handlePressUser(item)}
                onToggleFollow={() => handleToggleFollow(item.user_id)}
              />
            )}
          />
        )}
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  closeButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  listContent: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
  },
  fullName: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  username: {
    color: '#6a8ab0',
    fontSize: 12,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.red,
  },
  followingButton: {
    backgroundColor: colors.navy,
    borderWidth: 1,
    borderColor: colors.navyBorder,
  },
  followButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  followingButtonText: {
    color: colors.offWhite,
  },
});
