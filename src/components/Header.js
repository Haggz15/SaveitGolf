import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';

export default function Header({ right }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity onPress={() => navigation.navigate('Following')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={styles.logo}>SaveitGolf</Text>
      </TouchableOpacity>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navy,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.navyBorder,
  },
  logo: {
    fontFamily: 'DancingScript_700Bold',
    fontSize: 32,
    color: colors.white,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
