import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { colors, useTheme } from '../src/theme';
import { useStore } from '../src/lib/store';
import { configureNotifications, scheduleReminders } from '../src/lib/notifications';
import { generalStreak } from '../src/lib/score';
import { todayKey } from '../src/lib/date';
import { AppShell } from '../src/components/AppShell';

/** Fundo claro pede status bar escura; sem isto o relógio do sistema some no tema claro. */
function isLightColor(hex: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return false;
  const v = [0, 2, 4].map((i) => parseInt(m[1]!.slice(i, i + 2), 16) / 255);
  const lin = v.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  const lum = 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
  return lum > 0.5;
}

export default function RootLayout() {
  const t = useTheme();
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
    // `askPermission: false`: o diálogo só aparece a partir de um toque do usuário
    // (onboarding ou Perfil). Aqui, se a permissão já existe, reagenda; se não,
    // devolve `denied` e o Perfil mostra o aviso em vez de fingir que agenda.
    void scheduleReminders(settings, streak, area);
  }, [status, settings, days, goals]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style={isLightColor(t.bgPrimary) ? 'dark' : 'light'} backgroundColor={t.bgPrimary} />
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
