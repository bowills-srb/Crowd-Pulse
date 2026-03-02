import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { MapPin, Users, Bell, User } from 'lucide-react-native';
import { palette } from '../theme/palette';

import { useAuthStore } from '../context/authStore';

// Auth Screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import VerifyCodeScreen from '../screens/auth/VerifyCodeScreen';
import CreateProfileScreen from '../screens/auth/CreateProfileScreen';

// Main Screens
import RadarScreen from '../screens/main/RadarScreen';
import FriendsScreen from '../screens/main/FriendsScreen';
import ActivityScreen from '../screens/main/ActivityScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// Detail Screens
import VenueDetailScreen from '../screens/VenueDetailScreen';
import PingDetailScreen from '../screens/PingDetailScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Stack
const AuthStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animation: 'slide_from_right',
    }}
  >
    <Stack.Screen name="Welcome" component={WelcomeScreen} />
    <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
    <Stack.Screen name="VerifyCode" component={VerifyCodeScreen} />
    <Stack.Screen name="CreateProfile" component={CreateProfileScreen} />
  </Stack.Navigator>
);

// Main Tab Navigator
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarStyle: {
        backgroundColor: palette.bgSoft,
        borderTopColor: palette.stroke,
        height: 85,
        paddingBottom: 25,
        paddingTop: 10,
      },
      tabBarActiveTintColor: palette.accent,
      tabBarInactiveTintColor: palette.textSoft,
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '500',
      },
    }}
  >
    <Tab.Screen
      name="Radar"
      component={RadarScreen}
      options={{
        tabBarIcon: ({ color, size }) => <MapPin color={color} size={size} />,
        tabBarLabel: 'Radar',
      }}
    />
    <Tab.Screen
      name="Friends"
      component={FriendsScreen}
      options={{
        tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        tabBarLabel: 'Friends',
      }}
    />
    <Tab.Screen
      name="Activity"
      component={ActivityScreen}
      options={{
        tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        tabBarLabel: 'Activity',
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        tabBarLabel: 'Profile',
      }}
    />
  </Tab.Navigator>
);

// Main Stack (with tabs + modal screens)
const MainStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="MainTabs" component={MainTabs} />
    <Stack.Screen
      name="VenueDetail"
      component={VenueDetailScreen}
      options={{ presentation: 'modal' }}
    />
    <Stack.Screen
      name="PingDetail"
      component={PingDetailScreen}
      options={{ presentation: 'modal' }}
    />
    <Stack.Screen
      name="GroupDetail"
      component={GroupDetailScreen}
      options={{ presentation: 'modal' }}
    />
  </Stack.Navigator>
);

// Loading Screen
const LoadingScreen = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: palette.bg }}>
    <ActivityIndicator size="large" color={palette.accent} />
  </View>
);

// Root Navigator
export const RootNavigator = () => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
};

export default RootNavigator;
