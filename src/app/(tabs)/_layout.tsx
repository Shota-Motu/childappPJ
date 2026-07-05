import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({
  outline,
  filled,
  focused,
  color,
}: {
  outline: IconName;
  filled: IconName;
  focused: boolean;
  color: ColorValue;
}) {
  return <Ionicons name={focused ? filled : outline} size={24} color={color} />;
}

export default function TabsLayout() {
  const palette = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textSecondary,
        tabBarStyle: { backgroundColor: palette.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'きょう',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon outline="camera-outline" filled="camera" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'カレンダー',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon
              outline="calendar-outline"
              filled="calendar"
              focused={focused}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="album"
        options={{
          title: 'アルバム',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon outline="images-outline" filled="images" focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon outline="settings-outline" filled="settings" focused={focused} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
