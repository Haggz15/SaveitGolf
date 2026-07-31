import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import colors from '../../theme/colors';
import ProgressSteps from '../../components/auth/ProgressSteps';
import AvatarPicker from '../../components/auth/AvatarPicker';
import AuthTextField from '../../components/auth/AuthTextField';
import StateSelect from '../../components/auth/StateSelect';
import { useAuth } from '../../context/AuthContext';
import { friendlyAuthError } from '../../services/authErrors';

export default function ProfileSetupScreen() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useAuth();

  const [avatarUri, setAvatarUri] = useState(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [homeState, setHomeState] = useState('');
  const [handicap, setHandicap] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!fullName.trim()) next.fullName = 'Enter your full name.';
    if (!username.trim()) next.username = 'Choose a username.';
    else if (!/^[a-z0-9_.]{3,20}$/i.test(username.trim())) {
      next.username = '3-20 characters: letters, numbers, underscores.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await completeOnboarding({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        homeState: homeState || undefined,
        handicap: handicap.trim() ? Number(handicap.trim()) : undefined,
      });
      // RootNavigator switches to the Feed automatically once the profile row exists.
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    setLoading(true);
    setErrors({});
    try {
      await completeOnboarding({});
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top + 20 }}>
        <ProgressSteps step={2} total={3} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.headline}>Set up your profile</Text>
        <Text style={styles.subtext}>Tell us a bit about yourself</Text>

        <AvatarPicker uri={avatarUri} onChange={setAvatarUri} />

        <View style={styles.section}>
          <AuthTextField
            placeholder="Full name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            textContentType="name"
            error={errors.fullName}
          />
          <AuthTextField
            prefix="@"
            placeholder="username"
            value={username}
            onChangeText={setUsername}
            error={errors.username}
          />
          <StateSelect value={homeState} onChange={setHomeState} />
          <AuthTextField
            placeholder="Handicap index"
            value={handicap}
            onChangeText={setHandicap}
            keyboardType="decimal-pad"
          />
          <Text style={styles.helperText}>Don't know yours? You can add this later.</Text>

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleContinue}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Saving…' : 'Continue'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} style={styles.skipWrapper} disabled={loading}>
            <Text style={styles.skipLink}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },
  headline: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtext: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    width: '100%',
    marginTop: 20,
  },
  helperText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 20,
    marginLeft: 2,
  },
  formError: {
    color: colors.red,
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  skipWrapper: {
    alignItems: 'center',
    marginTop: 18,
  },
  skipLink: {
    color: colors.red,
    fontSize: 14,
    fontWeight: '600',
  },
});
