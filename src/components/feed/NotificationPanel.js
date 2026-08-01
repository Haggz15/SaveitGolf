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
import { getNotifications, markAllNotificationsRead } from '../../services/notifications';

const NOTIFICATION_ICONS = {
  like: 'heart',
  comment: 'chatbubble',
  share: 'share-social',
  mention: 'at',
};

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

export default function NotificationPanel({ visible, onClose, userId, onMarkedRead }) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const panelWidth = Math.round(screenWidth * 0.25);
  const translateX = useRef(new Animated.Value(panelWidth)).current;
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }).start();

      setLoading(true);
      getNotifications(userId)
        .then(setNotifications)
        .catch((err) => console.error('Failed to load notifications:', err))
        .finally(() => setLoading(false));

      markAllNotificationsRead(userId)
        .then(() => onMarkedRead?.())
        .catch((err) => console.error('Failed to mark notifications read:', err));
    } else if (mounted) {
      Animated.timing(translateX, { toValue: panelWidth, duration: 200, useNativeDriver: true }).start(() => {
        setMounted(false);
      });
    }
  }, [visible, userId]);

  if (!mounted) return null;

  return (
    <Modal visible={mounted} animationType="none" transparent onRequestClose={onClose}>
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.panel,
            { width: panelWidth, paddingTop: insets.top + 12, transform: [{ translateX }] },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Alerts</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={colors.muted} />
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
              contentContainerStyle={{ paddingBottom: 24 }}
              renderItem={({ item }) => (
                <View style={[styles.row, !item.read && styles.rowUnread]}>
                  <NotificationAvatar avatarUrl={item.actorAvatarUrl} name={item.actorFullName || item.actorUsername} />
                  <View style={styles.rowBody}>
                    <Ionicons
                      name={NOTIFICATION_ICONS[item.type] ?? 'notifications'}
                      size={11}
                      color={colors.red}
                      style={styles.rowIcon}
                    />
                    <Text style={styles.rowText} numberOfLines={3}>
                      <Text style={styles.rowUsername}>{item.actorUsername}</Text> {item.actionText}
                    </Text>
                    <Text style={styles.rowTime}>{item.timeAgo}</Text>
                  </View>
                </View>
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
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(6, 14, 26, 0.5)',
  },
  panel: {
    backgroundColor: colors.navy,
    borderLeftWidth: 1,
    borderLeftColor: colors.navyBorder,
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginTop: 20,
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  rowUnread: {
    backgroundColor: 'rgba(192, 0, 26, 0.1)',
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
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
    fontSize: 10,
    fontWeight: '700',
  },
  rowBody: {
    flex: 1,
  },
  rowIcon: {
    marginBottom: 2,
  },
  rowUsername: {
    color: colors.white,
    fontWeight: '700',
  },
  rowText: {
    color: colors.offWhite,
    fontSize: 10,
    lineHeight: 13,
  },
  rowTime: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 3,
  },
});
