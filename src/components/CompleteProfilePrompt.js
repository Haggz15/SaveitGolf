import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { friendlyAuthError } from '../services/authErrors';

const shownKey = (userId) => `completeProfilePromptShown:${userId}`;

// One-time "Finish your profile" popup for accounts that got through signup
// without a full name or username — the old onboarding screen had a Skip
// button, so some profiles are missing one or both. Like the update prompt
// (see useOneTimeUpdatePrompt), the "shown" flag is saved *before* it opens,
// so it never comes back whether the user saves, taps "Later" or force-quits.
// After that, Profile's "Edit Name & Username" is where they can fill it in.
//
// `blocked` holds it back while another launch popup (the App Store update
// prompt) is on screen, so the two never stack.
export default function CompleteProfilePrompt({ blocked = false }) {
  const { session, profile, passwordRecovery, updateProfile } = useAuth();
  const [visible, setVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const userId = session?.user?.id;
  const incomplete = Boolean(profile) && (!profile.full_name?.trim() || !profile.username?.trim());

  useEffect(() => {
    if (!userId || !incomplete || blocked || passwordRecovery || visible) return undefined;
    let cancelled = false;
    (async () => {
      try {
        if (await AsyncStorage.getItem(shownKey(userId))) return;
        await AsyncStorage.setItem(shownKey(userId), 'true');
        if (cancelled) return;
        setFullName(profile.full_name || '');
        setUsername(profile.username || '');
        setErrors({});
        setVisible(true);
      } catch (err) {
        // If the flag can't be read or written, skip rather than risk
        // showing it on every launch.
        console.log('Complete-profile prompt skipped:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only re-check when who's signed in, or whether their profile is complete, changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, incomplete, blocked, passwordRecovery]);

  const canSave = fullName.trim().length > 0 && username.trim().length > 0;

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,20}$/i.test(trimmedUsername)) {
      setErrors({ username: '3-20 characters: letters, numbers, underscores.' });
      return;
    }

    const changes = {};
    if (trimmedName !== (profile?.full_name || '')) changes.fullName = trimmedName;
    if (trimmedUsername !== (profile?.username || '')) changes.username = trimmedUsername;

    setErrors({});
    setSaving(true);
    try {
      if (Object.keys(changes).length > 0) await updateProfile(changes);
      setVisible(false);
    } catch (err) {
      console.error('Failed to complete profile:', err);
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.card}>
          <Text style={styles.title}>Finish your profile ⛳</Text>
          <Text style={styles.message}>Add your name and a username so other golfers can find you.</Text>

          <Text style={styles.label}>Full name</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Your full name"
            placeholderTextColor={colors.muted}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            maxLength={50}
            style={styles.input}
          />

          <Text style={styles.label}>Username</Text>
          <View style={[styles.input, styles.usernameRow, errors.username && styles.inputError]}>
            <Text style={styles.prefix}>@</Text>
            <TextInput
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setErrors({});
              }}
              placeholder="username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={styles.usernameInput}
            />
          </View>
          {errors.username ? <Text style={styles.error}>{errors.username}</Text> : null}
          {errors.form ? <Text style={styles.error}>{errors.form}</Text> : null}

          <TouchableOpacity
            style={[styles.button, (!canSave || saving) && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>Save</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.dismissButton} onPress={() => setVisible(false)} activeOpacity={0.7}>
            <Text style={styles.dismissText}>Later</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.navyCard,
    borderColor: colors.navyBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
  },
  title: {
    color: colors.white,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 12,
    opacity: 0.9,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.navy,
    borderColor: colors.navyBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 46,
    color: colors.white,
    fontSize: 15,
  },
  inputError: {
    borderColor: colors.red,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    color: colors.muted,
    fontSize: 15,
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    height: '100%',
    color: colors.white,
    fontSize: 15,
  },
  error: {
    color: colors.red,
    fontSize: 12,
    marginTop: 6,
  },
  button: {
    marginTop: 18,
    backgroundColor: colors.red,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  dismissButton: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissText: {
    color: colors.white,
    opacity: 0.7,
    fontSize: 15,
    fontWeight: '600',
  },
});
