import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../../theme/colors';

export default function AvatarPicker({ uri, onChange }) {
  const pickImage = async () => {
    const ImagePicker = require('expo-image-picker');

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to add a profile photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets?.[0]?.uri) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <TouchableOpacity style={styles.wrapper} onPress={pickImage} activeOpacity={0.8}>
      <View style={styles.circle}>
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Ionicons name="camera-outline" size={28} color={colors.muted} />
        )}
        <View style={styles.badge}>
          <Ionicons name="camera" size={14} color={colors.white} />
        </View>
      </View>
      <Text style={styles.label}>{uri ? 'Change photo' : 'Add photo'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    marginBottom: 8,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.navyCard,
    borderWidth: 1,
    borderColor: colors.navyBorder,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  image: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  badge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.navy,
  },
  label: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
});
