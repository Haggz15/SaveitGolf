import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';

import colors from '../../theme/colors';
import AuthLogo from '../../components/auth/AuthLogo';
import AuthTextField from '../../components/auth/AuthTextField';
import { useAuth } from '../../context/AuthContext';
import { updatePassword } from '../../services/auth';
import { friendlyAuthError } from '../../services/authErrors';

// Rendered by RootNavigator in place of the normal session-based routing
// whenever AuthContext's passwordRecovery flag is set (Fix 9) — see the
// comment on that flag for how a click on the emailed reset link gets here.
export default function ResetPasswordScreen() {
  const { completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const validate = () => {
    const next = {};
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSetPassword = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      await updatePassword(password);
      completePasswordRecovery();
      Alert.alert('Password updated', "You're all set — you're now signed in with your new password.");
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelPasswordRecovery();
    } catch (err) {
      console.error('Failed to cancel password recovery:', err);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthLogo />

        <Text style={styles.headline}>Set a new password</Text>
        <Text style={styles.subtext}>Choose a new password for your account</Text>

        <View style={styles.section}>
          <AuthTextField
            placeholder="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            error={errors.password}
          />
          <AuthTextField
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            error={errors.confirmPassword}
          />

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleSetPassword}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Saving…' : 'Save New Password'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleCancel} disabled={cancelling} style={styles.cancelWrapper}>
            <Text style={styles.cancelText}>Cancel and back to Sign In</Text>
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
    paddingTop: 72,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  headline: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  subtext: {
    color: '#8a9ab0',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 28,
    textAlign: 'center',
  },
  section: {
    width: '100%',
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
    marginTop: 4,
  },
  disabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  cancelWrapper: {
    alignSelf: 'center',
    marginTop: 20,
  },
  cancelText: {
    color: '#8a9ab0',
    fontSize: 13,
  },
});
