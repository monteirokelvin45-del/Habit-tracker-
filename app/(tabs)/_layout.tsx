import React from 'react';
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '../../src/theme';
import { useStore } from '../../src/lib/store';
import { detectDanger } from '../../src/lib/score';
import { dangerNotification } from '../../src/lib/notifications';
import { todayKey } from '../../src/lib/date';

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const days = useStore((s) => s.days);
  const goals = useStore((s) => s.goals);
  const settings = useStore((s) => s.settings);

  // Notificação de zona de perigo: no máximo 1x por dia, com base nos thresholds reais.
  React.useEffect(() => {
    const key = `myprime:dangerNotified:${todayKey()}`;
    const alerts = detectDanger(days, goals, settings);
    const red = alerts.find((a) => a.level === 'red') ?? alerts[0];
    if (!red) return;
    let cancelled = false;
    void (async () => {
      try {
        const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
        const already = await AsyncStorage.getItem(key);
        if (already || cancelled) return;
        await dangerNotification(red.title.replace(/^Zona de Perigo: /, ''));
        await AsyncStorage.setItem(key, '1');
      } catch {
        // sem permissão / web: silencioso
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, goals, settings]);

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
        name="copilot"
        options={{ title: 'Copilot', tabBarIcon: ({ focused }) => <TabIcon emoji="🤖" focused={focused} /> }}
      />
      <Tabs.Screen
        name="perfil"
        options={{ title: 'Perfil', tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}
