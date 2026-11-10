import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
import { useStore } from '../src/lib/store';
import { configureNotifications, scheduleReminders } from '../src/lib/notifications';
import { generalStreak } from '../src/lib/score';

export default function RootLayout() {
  const load = useStore((s) => s.load);
  const status = useStore((s) => s.status);

  useEffect(() => {
    void load();
    void configureNotifications();
  }, [load]);

  // Reagenda lembretes sempre que o app abre e já existem dados.
  const settings = useStore((s) => s.settings);
  const days = useStore((s) => s.days);
  const goals = useStore((s) => s.goals);
  useEffect(() => {
    if (status !== 'ready') return;
    const streak = generalStreak(days);
    const area = goals.find((g) => g.priority === 'high' && g.active)?.area ?? 'sua rotina';
    void scheduleReminders(settings, streak, area);
  }, [status, settings, days, goals]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={colors.bgPrimary} />
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
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
      </View>
    </SafeAreaProvider>
  );
}
