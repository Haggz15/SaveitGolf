import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import colors from '../theme/colors';
import FeedScreen from '../screens/FeedScreen';
import MapScreen from '../screens/MapScreen';
import PostScreen from '../screens/PostScreen';
import ScorecardScreen from '../screens/ScorecardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CourseDetailScreen from '../screens/CourseDetailScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.navy,
    card: colors.navy,
    border: colors.navyBorder,
    primary: colors.red,
  },
};

const TAB_ICONS = {
  Feed: 'newspaper-outline',
  Map: 'map-outline',
  Scorecard: 'reader-outline',
  Profile: 'person-outline',
};

const TAB_ICONS_FOCUSED = {
  Feed: 'newspaper',
  Map: 'map',
  Scorecard: 'reader',
  Profile: 'person',
};

function CenterPostButton({ onPress }) {
  return (
    <TouchableOpacity style={styles.centerButtonWrapper} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.centerButton}>
        <Ionicons name="add" size={30} color={colors.white} />
      </View>
    </TouchableOpacity>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: colors.red,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.navy,
          borderTopColor: colors.navyBorder,
          borderTopWidth: 1,
          height: 82,
          paddingTop: 8,
          paddingBottom: 20,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ focused, color, size }) => {
          const iconSet = focused ? TAB_ICONS_FOCUSED : TAB_ICONS;
          return <Ionicons name={iconSet[route.name]} size={size ?? 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen
        name="Post"
        component={PostScreen}
        options={{
          tabBarLabel: () => null,
          tabBarIcon: () => null,
          tabBarButton: (props) => <CenterPostButton onPress={props.onPress} />,
        }}
      />
      <Tab.Screen name="Scorecard" component={ScorecardScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs" component={Tabs} />
        <Stack.Screen
          name="CourseDetail"
          component={CourseDetailScreen}
          options={{ presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centerButtonWrapper: {
    top: -22,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  centerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.navy,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
});
