import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors } from '../src/theme';
import { useStore } from '../src/lib/store';
import { configureNotifications, scheduleReminders } from '../src/lib/notifications';
import { generalStreak } from '../src/lib/score';
import { todayKey } from '../src/lib/date';
import { AppShell } from '../src/components/AppShell';

export default function RootLayout() {
  const load = useStore((s) => s.load);
  const status = useStore((s) => s.status);

  useEffect(() => {
    void load();
    void configureNotifications();
  }, [load]);

  // Reagenda lembretes por dia, não a cada mudança de estado: `days`/`goals` mudam
  // dezenas de vezes por sessão e cada `scheduleReminders` relê as 14 chaves do
  // AsyncStorage — recomputar o streak também custava O(dias × metas).
  const settings = useStore((s) => s.settings);
  const days = useStore((s) => s.days);
  const goals = useStore((s) => s.goals);
  const lastScheduled = useRef<string>('');
  useEffect(() => {
    if (status !== 'ready') return;
    const today = todayKey();
    if (lastScheduled.current === today) return;
    lastScheduled.current = today;
    const streak = generalStreak(days);
    const area = goals.find((g) => g.priority === 'high' && g.active)?.area ?? 'sua rotina';
    void scheduleReminders(settings, streak, area);
  }, [status, settings, days, goals]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" backgroundColor={colors.bgPrimary} />
        <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
          <AppShell>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bgPrimary },
                animation: 'slide_from_right',
                animationDuration: 250,
              }}
            >
              <Stack.Screen name="index" />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            </Stack>
          </AppShell>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
