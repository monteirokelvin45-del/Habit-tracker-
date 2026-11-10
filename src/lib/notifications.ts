import { Platform } from 'react-native';
import { colors } from '../theme';
import type { Settings } from './types';

/**
 * expo-notifications é carregado sob demanda: no web o módulo não é suportado
 * e um import estático derrubaria a tela inteira.
 */
type NotificationsModule = typeof import('expo-notifications');

function getNotifications(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

const CHANNEL_ID = 'myprime-reminders';

export async function configureNotifications(): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Lembretes MY PRIME',
        importance: N.AndroidImportance.DEFAULT,
        lightColor: colors.green,
        vibrationPattern: [0, 120],
      });
    }
  } catch (e) {
    console.warn('[MY PRIME] notifications setup', e);
  }
}

export async function ensurePermission(): Promise<boolean> {
  const N = getNotifications();
  if (!N) return false;
  try {
    const current = await N.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await N.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const [h, m] = hhmm.split(':');
  return { hour: Number(h ?? 7), minute: Number(m ?? 0) };
}

/** Reagenda todos os lembretes locais segundo as configurações. */
export async function scheduleReminders(settings: Settings, streakDays: number, streakArea: string): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    const granted = await ensurePermission();
    if (!granted) return;
    await N.cancelAllScheduledNotificationsAsync();

    const trigger = (type: 'DAILY' | 'WEEKLY', extra: Record<string, number>) => ({
      type: type === 'DAILY' ? N.SchedulableTriggerInputTypes.DAILY : N.SchedulableTriggerInputTypes.WEEKLY,
      channelId: CHANNEL_ID,
      ...extra,
    });

    const daily = async (id: string, title: string, body: string, time: string) => {
      const { hour, minute } = parseTime(time);
      await N.scheduleNotificationAsync({
        identifier: id,
        content: { title, body, sound: false },
        trigger: trigger('DAILY', { hour, minute }) as never,
      });
    };

    await daily('morning', 'Bom dia.', 'Qual sua energia hoje? Defina o modo do dia em 30 segundos.', settings.morningReminder);
    await daily('night', 'Hora de fechar o dia.', 'O que foi feito? O registro é o que transforma intenção em dados.', settings.nightReminder);

    if (settings.middayCheckin) {
      await daily('midday', 'Como está a metade do dia?', 'Já fez a prioridade? Ainda dá tempo de corrigir a rota.', settings.middayTime);
    }

    if (settings.streakNotification && streakDays > 0) {
      await daily(
        'streak',
        `🔥 ${streakDays} ${streakDays === 1 ? 'dia' : 'dias'} seguidos`,
        `Você está em série em ${streakArea}. Não quebre.`,
        settings.morningReminder,
      );
    }

    await N.scheduleNotificationAsync({
      identifier: 'weekly-review',
      content: { title: '📊 Sua revisão semanal está pronta.', body: 'Abra MY PRIME → Revisões para fechar a semana.', sound: false },
      trigger: trigger('WEEKLY', { weekday: 1, hour: 20, minute: 0 }) as never,
    });
  } catch (e) {
    console.warn('[MY PRIME] scheduleReminders', e);
  }
}

export async function notifyNow(title: string, body: string): Promise<void> {
  const N = getNotifications();
  if (!N) return;
  try {
    const granted = await ensurePermission();
    if (!granted) return;
    await N.scheduleNotificationAsync({ content: { title, body, sound: false }, trigger: null });
  } catch {
    // silencioso por design
  }
}

export async function dangerNotification(area: string): Promise<void> {
  await notifyNow('⚠️ Atenção', `${area} em queda. Abra o app e ative o modo recuperação.`);
}
