import { View, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import colors from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import FeedScreen from '../screens/FeedScreen';
import MapScreen from '../screens/MapScreen';
import PostScreen from '../screens/PostScreen';
import ScorecardScreen from '../screens/ScorecardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OtherUserProfileScreen from '../screens/OtherUserProfileScreen';
import UserScorecardsScreen from '../screens/UserScorecardsScreen';
import CourseDetailScreen from '../screens/CourseDetailScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import LogInScreen from '../screens/auth/LogInScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();

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
  const { session, needsOnboarding, initializing } = useAuth();

  if (initializing) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.red} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {!session ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="SignUp" component={SignUpScreen} />
          <AuthStack.Screen name="LogIn" component={LogInScreen} />
        </AuthStack.Navigator>
      ) : needsOnboarding ? (
        <ProfileSetupScreen />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Tabs" component={Tabs} />
          <Stack.Screen
            name="CourseDetail"
            component={CourseDetailScreen}
            options={{ presentation: 'modal' }}
          />
          {/* Reuses FeedScreen itself (see its `route.params.filter` handling)
              for the course/hole full-screen swipe feeds pushed from
              CourseDetailScreen — a real stack screen rather than a tab so it
              gets its own back button and no bottom tab bar. */}
          <Stack.Screen name="CourseFeed" component={FeedScreen} />
          <Stack.Screen name="UserProfile" component={OtherUserProfileScreen} />
          <Stack.Screen name="UserScorecards" component={UserScorecardsScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navy,
  },
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
