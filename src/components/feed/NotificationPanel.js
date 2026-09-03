import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';
import { getNotifications, markNotificationRead } from '../../services/notifications';
import { useNotifications } from '../../context/NotificationsContext';

const AUTO_READ_DELAY_MS = 3000;

function getInitials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 1).toUpperCase();
}

function NotificationAvatar({ avatarUrl, name }) {
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback]}>
      <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
    </View>
  );
}

export default function NotificationPanel({ visible, onClose, userId, onPressNotification }) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const panelHeight = Math.round(screenHeight * 0.75);
  const { markAllRead } = useNotifications();
  const translateY = useRef(new Animated.Value(panelHeight)).current;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateY, { toValue: 0, duration: 260, useNativeDriver: true }).start();

      setLoading(true);
      getNotifications(userId)
        .then(setNotifications)
        .catch((err) => console.error('Failed to load notifications:', err))
        .finally(() => setLoading(false));
    } else if (mounted) {
      Animated.timing(translateY, { toValue: panelHeight, duration: 220, useNativeDriver: true }).start(() => {
        setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, userId]);

  // A few seconds after the panel opens, treat everything in it as "seen" —
  // clears the badge/border even for rows the user never actually tapped,
  // same as most feeds distinguish "seen" from "read".
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }, AUTO_READ_DELAY_MS);
    return () => clearTimeout(timer);
  }, [visible, markAllRead]);

  // Marks just this one notification read (optimistically, then persisted)
  // and hands it to the parent to decide where tapping it should navigate —
  // the panel only knows about notifications, not the feed's post list.
  function handlePressNotification(item) {
    if (!item.read) {
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      markNotificationRead(item.id).catch((err) => console.error('Failed to mark notification read:', err));
    }
    onPressNotification?.(item);
  }

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      animationType="none"
      transparent
      supportedOrientations={['portrait']}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View style={[styles.panel, { height: panelHeight, transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.red} style={{ marginTop: 24 }} />
          ) : notifications.length === 0 ? (
            <Text style={styles.emptyText}>No notifications yet.</Text>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, !item.read && styles.rowUnread]}
                  onPress={() => handlePressNotification(item)}
                  activeOpacity={0.75}
                >
                  <NotificationAvatar avatarUrl={item.actorAvatarUrl} name={item.actorFullName || item.actorUsername} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowText} numberOfLines={3}>
                      <Text style={styles.rowUsername}>{item.actorUsername}</Text>
                      <Text style={styles.rowMessage}> {item.actionText}</Text>
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowTime}>{item.timeAgo}</Text>
                    {item.thumbnailUrl && <Image source={{ uri: item.thumbnailUrl }} style={styles.rowThumbnail} />}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 26, 0.5)',
  },
  panel: {
    backgroundColor: colors.navy,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: colors.navyBorder,
    overflow: 'hidden',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.navyBorder,
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    color: colors.white,
    fontFamily: 'Cinzel_700Bold',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 14,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  rowUnread: {
    borderLeftColor: '#4a9eff',
    backgroundColor: 'rgba(74, 158, 255, 0.08)',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarFallback: {
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
    marginRight: 8,
  },
  rowText: {
    lineHeight: 18,
  },
  rowUsername: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  rowMessage: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '400',
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 6,
  },
  rowTime: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'right',
  },
  rowThumbnail: {
    width: 52,
    height: 52,
    borderRadius: 6,
  },
});
