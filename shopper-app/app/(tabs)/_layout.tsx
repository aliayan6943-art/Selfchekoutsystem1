import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6C63FF',
        tabBarInactiveTintColor: isDark ? '#555' : '#aaa',
        tabBarStyle: {
          backgroundColor: isDark ? '#0D0D1A' : '#FFFFFF',
          borderTopColor: isDark ? '#1A1A2E' : '#F0F0F0',
          borderTopWidth: 1,
          height: 65,
          paddingBottom: 8,
          paddingTop: 6,
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="barcode.viewfinder" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={26} name="cart.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
