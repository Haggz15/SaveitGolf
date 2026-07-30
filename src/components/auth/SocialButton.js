import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const VARIANTS = {
  apple: {
    backgroundColor: '#ffffff',
    textColor: '#000000',
    icon: 'logo-apple',
    label: 'Continue with Apple',
  },
  google: {
    backgroundColor: '#1c1c1e',
    textColor: '#ffffff',
    icon: 'logo-google',
    label: 'Continue with Google',
  },
};

export default function SocialButton({ variant, onPress, loading, disabled }) {
  const config = VARIANTS[variant];

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: config.backgroundColor }, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color={config.textColor} />
      ) : (
        <>
          <Ionicons name={config.icon} size={19} color={config.textColor} style={styles.icon} />
          <Text style={[styles.label, { color: config.textColor }]}>{config.label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    borderRadius: 12,
    marginBottom: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
