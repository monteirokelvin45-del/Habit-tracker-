import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../src/theme';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bgCard,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.bgPrimary },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Hoje', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="revisoes"
        options={{ title: 'Revisões', tabBarIcon: ({ focused }) => <TabIcon emoji="📊" focused={focused} /> }}
      />
      <Tabs.Screen
        name="metas"
        options={{ title: 'Metas', tabBarIcon: ({ focused }) => <TabIcon emoji="🎯" focused={focused} /> }}
      />
      <Tabs.Screen
        name="inteligencia"
        options={{ title: 'Inteligência', tabBarIcon: ({ focused }) => <TabIcon emoji="🧠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
