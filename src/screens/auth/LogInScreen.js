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
import SocialButton from '../../components/auth/SocialButton';
import Divider from '../../components/auth/Divider';
import AuthTextField from '../../components/auth/AuthTextField';
import { signInWithEmail, signInWithApple, signInWithGoogle } from '../../services/auth';
import { friendlyAuthError } from '../../services/authErrors';
import { supabase } from '../../services/supabase';

export default function LogInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null);

  const handleLogIn = async () => {
    if (!email.trim() || !password) {
      setErrors({ form: 'Enter your email and password.' });
      return;
    }
    setLoading(true);
    setErrors({});
    try {
      await signInWithEmail(email.trim(), password);
      // AuthContext picks up the new session and RootNavigator routes on.
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleApple = async () => {
    setSocialLoading('apple');
    setErrors({});
    try {
      await signInWithApple();
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGoogle = async () => {
    setSocialLoading('google');
    setErrors({});
    try {
      await signInWithGoogle();
    } catch (err) {
      setErrors({ form: friendlyAuthError(err) });
    } finally {
      setSocialLoading(null);
    }
  };

  const handleForgotPassword = async () => {
    if (!EMAIL_RE.test(email.trim())) {
      Alert.alert('Forgot password', 'Enter your email address above first, then tap "Forgot password?" again.');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) throw error;
      Alert.alert('Check your email', 'We sent you a link to reset your password.');
    } catch (err) {
      Alert.alert('Error', friendlyAuthError(err));
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AuthLogo />

        <Text style={styles.headline}>Welcome back</Text>
        <Text style={styles.subtext}>Log in to your SaveitGolf account</Text>

        <View style={styles.section}>
          <SocialButton variant="apple" onPress={handleApple} loading={socialLoading === 'apple'} disabled={!!socialLoading} />
          <SocialButton variant="google" onPress={handleGoogle} loading={socialLoading === 'google'} disabled={!!socialLoading} />

          <Divider />

          <AuthTextField
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <AuthTextField
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="password"
          />

          {errors.form ? <Text style={styles.formError}>{errors.form}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.disabled]}
            onPress={handleLogIn}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>{loading ? 'Logging in…' : 'Log In'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotWrapper}>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.footerLink}>Sign up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    fontSize: 24,
    fontWeight: '800',
    marginTop: 28,
  },
  subtext: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 28,
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
  forgotWrapper: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotLink: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    marginTop: 32,
  },
  footerText: {
    color: colors.muted,
    fontSize: 13,
  },
  footerLink: {
    color: colors.red,
    fontSize: 13,
    fontWeight: '700',
  },
});
