import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';

import colors from '../../theme/colors';
import AuthLogo from '../../components/auth/AuthLogo';
import AuthTextField from '../../components/auth/AuthTextField';
import { signUpWithEmail, signInWithEmail } from '../../services/auth';
import { friendlyAuthError, isEmailNotConfirmedError } from '../../services/authErrors';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < 6) next.password = 'Password must be at least 6 characters.';
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleCreateAccount = async () => {
    if (!validate()) return;
    setLoading(true);
    setErrors({});
    try {
      const data = await signUpWithEmail(email.trim(), password);
      if (!data.session) {
        // Email confirmation is disabled project-wide, so a session should
        // come back immediately — sign in explicitly as a fallback so the
        // user is never stuck waiting on a confirmation email.
        await signInWithEmail(email.trim(), password);
      }
      // AuthContext picks up the session and RootNavigator routes straight
      // to Profile Setup.
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        // Stale unconfirmed flag on an account created before email
        // confirmation was disabled — retry once silently rather than
        // showing a "verify your email" message.
        try {
          await signInWithEmail(email.trim(), password);
          return;
        } catch (retryErr) {
          console.warn('[signup] silent email-not-confirmed retry failed:', retryErr);
        }
      }
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
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthLogo />

        <Text style={styles.headline}>Join SaveitGolf</Text>
        <Text style={styles.subtext}>The social app for golfers</Text>

        <View style={styles.section}>
          <AuthTextField
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
            error={errors.email}
            fieldStyle={styles.inputField}
          />
          <AuthTextField
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            error={errors.password}
            fieldStyle={styles.inputField}
          />
          <AuthTextField
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            error={errors.confirmPassword}
            fieldStyle={styles.inputField}
          />

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleCreateAccount}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Creating account…' : 'Create Account'}</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing, you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => Alert.alert('Terms of Service', 'Coming soon.')}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => Alert.alert('Privacy Policy', 'Coming soon.')}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('LogIn')}>
            <Text style={styles.footerLink}>Log In</Text>
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
  },
  subtext: {
    color: '#8a9ab0',
    fontSize: 12,
    marginTop: 12,
    marginBottom: 28,
  },
  section: {
    width: '100%',
  },
  inputField: {
    backgroundColor: '#1a2e4a',
    borderColor: '#2a4a6a',
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
  legal: {
    color: '#8a9ab0',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 14,
    lineHeight: 16,
  },
  legalLink: {
    color: colors.red,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 32,
  },
  footerText: {
    color: '#8a9ab0',
    fontSize: 13,
  },
  footerLink: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
});
