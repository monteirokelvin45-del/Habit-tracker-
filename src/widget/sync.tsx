import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useStore } from '../lib/store';
import { WIDGET_NAME } from './data';
import type { AppData } from '../lib/types';

/**
 * Mantém o widget sincronizado com o app.
 * Chamado nas telas principais: sempre que dias/goals/settings mudam, pedimos
 * um redraw. No web/Expo Go o módulo nativo não existe — falha silenciosa.
 */
export async function syncWidget(data: AppData): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { PrimeWidget } = await import('./PrimeWidget');
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: (info) => <PrimeWidget data={data} width={info.width} />,
    });
  } catch {
    // widget não instalado / módulo indisponível: nada a fazer
  }
}

export function useWidgetSync(): void {
  const days = useStore((s) => s.days);
  const goals = useStore((s) => s.goals);
  const settings = useStore((s) => s.settings);
  const rewards = useStore((s) => s.rewards);

  useEffect(() => {
    const timer = setTimeout(() => {
      void syncWidget(useStore.getState());
    }, 400);
    return () => clearTimeout(timer);
  }, [days, goals, settings, rewards]);
}
