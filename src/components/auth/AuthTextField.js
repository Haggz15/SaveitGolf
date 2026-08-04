import { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

export default function AuthTextField({
  prefix,
  error,
  secureTextEntry,
  containerStyle,
  fieldStyle,
  ...inputProps
}) {
  const [hidden, setHidden] = useState(!!secureTextEntry);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <View style={[styles.container, fieldStyle, error && styles.containerError]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={hidden}
          {...inputProps}
        />
        {secureTextEntry ? (
          <TouchableOpacity onPress={() => setHidden((v) => !v)} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 14,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
  },
  containerError: {
    borderColor: colors.red,
  },
  prefix: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: '600',
    marginRight: 4,
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 15,
  },
  error: {
    color: colors.red,
    fontSize: 12,
    marginTop: 6,
    marginLeft: 2,
  },
});
