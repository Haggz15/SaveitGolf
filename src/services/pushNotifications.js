import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { supabase } from './supabase';

const EAS_PROJECT_ID = '48ad35b3-294a-4970-b8fe-612a50cd94fb';

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

// Asks for permission (first launch only — iOS remembers the answer) and
// stores this device's Expo push token on the signed-in user's profile.
// No-op on web and simulators, which can't receive push.
export async function registerForPushNotifications(userId) {
  if (Platform.OS === 'web' || !Device.isDevice || !userId) return null;

  try {
    // The app was just opened — clear any badge left by earlier pushes.
    Notifications.setBadgeCountAsync(0).catch(() => {});

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });

    const { error } = await supabase.from('profiles').update({ push_token: token }).eq('user_id', userId);
    if (error) console.error('[push] failed to save push token:', error);

    return token;
  } catch (err) {
    console.error('[push] registration failed:', err);
    return null;
  }
}

async function sendPushNotification(toToken, title, body, data) {
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: toToken, title, body, data, sound: 'default', badge: 1 }),
  });
}

const PUSH_TEXT = {
  like: 'liked your post',
  comment: 'commented on your post',
  follow: 'started following you',
  save: 'saved your post',
  tag: 'tagged you in a post',
  mention: 'mentioned you in a comment',
};

// Called alongside every in-app notification (see notifications.js's
// createNotification) — only the types above push; everything else, like
// new_post fan-outs to followers, stays in-app only. Never throws: a failed
// push must not fail the like/comment/follow that triggered it.
export async function sendActivityPush({ userId, actorId, type, postId }) {
  const action = PUSH_TEXT[type];
  if (!action || !userId || !actorId || userId === actorId) return;
  try {
    const { data: rows, error } = await supabase
      .from('profiles')
      .select('user_id, username, push_token')
      .in('user_id', [userId, actorId]);
    if (error) throw error;

    const recipient = rows?.find((row) => row.user_id === userId);
    const actor = rows?.find((row) => row.user_id === actorId);
    if (!recipient?.push_token) return;

    await sendPushNotification(
      recipient.push_token,
      'SaveitGolf',
      `@${actor?.username ?? 'Someone'} ${action}`,
      { type, postId: postId ?? null, actorId }
    );
  } catch (err) {
    console.error('[push] failed to send push notification:', err);
  }
}
