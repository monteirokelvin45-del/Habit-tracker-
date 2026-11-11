/**
 * Integrações com o sistema Android.
 *
 * Tudo aqui é "melhor esforço": no web, no Expo Go ou sem permissão, a função
 * devolve um resultado explícito em vez de estourar. A UI mostra o que aconteceu
 * (regra 1: não fingir que funcionou).
 */
import { Platform } from 'react-native';
import type { ScheduleSlot } from './schedule';

export type NativeResult =
  | { ok: true; message: string }
  | { ok: false; message: string; reason: 'unsupported' | 'denied' | 'error' };

const CALENDAR_NAME = 'MY PRIME';

function unsupported(message = 'Recurso disponível apenas no Android.'): NativeResult {
  return { ok: false, message, reason: 'unsupported' };
}

/* ─────────────────────────────── Agenda ─────────────────────────────── */

/**
 * Sincroniza os blocos do dia com a agenda nativa.
 *
 * Cria/reaproveita a agenda "MY PRIME" e grava um evento por bloco em aberto.
 * Retorna quantos eventos entraram e quantos foram atualizados.
 */
export async function syncDayToCalendar(
  slots: ScheduleSlot[],
  dateISO: string,
  options: { titlePrefix?: string } = {},
): Promise<NativeResult> {
  if (Platform.OS === 'web') return unsupported('Sincronização de agenda não existe no navegador.');
  try {
    const Calendar = await import('expo-calendar');
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return { ok: false, message: 'Permissão de agenda negada.', reason: 'denied' };
    }

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    let calendarId = calendars.find((c) => c.title === CALENDAR_NAME)?.id;
    if (!calendarId) {
      const defaultSource =
        Platform.OS === 'ios'
          ? calendars.find((c) => c.source?.name === 'iCloud')?.source
          : calendars.find((c) => c.isPrimary)?.source;
      calendarId = await Calendar.createCalendarAsync({
        title: CALENDAR_NAME,
        color: '#0B2B26',
        entityType: Calendar.EntityTypes.EVENT,
        sourceId: defaultSource?.id,
        source: defaultSource as never,
        name: CALENDAR_NAME,
        ownerAccount: 'personal',
        accessLevel: Calendar.CalendarAccessLevel.OWNER,
      });
    }

    const [year, month, day] = dateISO.split('-').map(Number);
    let created = 0;
    for (const slot of slots) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const startDate = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1, sh ?? 9, sm ?? 0);
      const endDate = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1, eh ?? 10, em ?? 0);
      await Calendar.createEventAsync(calendarId, {
        title: `${options.titlePrefix ?? ''}${slot.title}`,
        notes: `MY PRIME · ${slot.area}`,
        startDate,
        endDate,
        alarms: [{ relativeOffset: -15 }],
      });
      created += 1;
    }
    return {
      ok: true,
      message: created
        ? `${created} bloco(s) na agenda do celular.`
        : 'Nenhum bloco em aberto para sincronizar.',
    };
  } catch (e) {
    return { ok: false, message: `Falha ao sincronizar agenda: ${String(e)}`, reason: 'error' };
  }
}

/* ─────────────────────────────── Alarme ─────────────────────────────── */

/**
 * Abre o app de Relógio do Android já preenchido (SET_ALARM).
 * O usuário confirma com um toque — o app não cria alarme pelas costas.
 */
export async function createNativeAlarm(hour: number, minute: number, label: string): Promise<NativeResult> {
  if (Platform.OS !== 'android') return unsupported('Alarme nativo existe só no Android.');
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    await IntentLauncher.startActivityAsync('android.intent.action.SET_ALARM', {
      extra: {
        'android.intent.extra.alarm.HOUR': hour,
        'android.intent.extra.alarm.MINUTES': minute,
        'android.intent.extra.alarm.MESSAGE': label.slice(0, 60),
        'android.intent.extra.alarm.SKIP_UI': false,
      },
    });
    return { ok: true, message: 'Relógio aberto para confirmar o alarme.' };
  } catch (e) {
    return { ok: false, message: `Não foi possível abrir o Relógio: ${String(e)}`, reason: 'error' };
  }
}

/**
 * Alarme de descanso do treino (60/90/120s).
 *
 * Notificação local com canal de alta prioridade: o app pode estar em segundo
 * plano durante a série e o aviso ainda precisa chegar.
 */
export async function restTimerAlarm(seconds: number): Promise<NativeResult> {
  if (Platform.OS === 'web') return unsupported('Alarme de descanso não existe no navegador.');
  try {
    const Notifications = await import('expo-notifications');
    const permission = await Notifications.getPermissionsAsync();
    let status = permission.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return { ok: false, message: 'Permissão de notificação negada.', reason: 'denied' };
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Descanso encerrado',
        body: `${seconds}s concluídos — próxima série.`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: { type: 'timeInterval', seconds, channelId: 'default' } as never,
    });
    return { ok: true, message: `Aviso em ${seconds}s.` };
  } catch (e) {
    return { ok: false, message: `Falha ao agendar descanso: ${String(e)}`, reason: 'error' };
  }
}

/** Abre Bem-Estar Digital / limite de apps do Android. */
export async function openAppLimits(): Promise<NativeResult> {
  if (Platform.OS !== 'android') return unsupported('Limite de apps existe só no Android.');
  try {
    const IntentLauncher = await import('expo-intent-launcher');
    // Telas candidatas, na ordem em que costumam existir nos Androids.
    const candidates = [
      'android.settings.APP_USAGE_SETTINGS',
      'android.settings.SETTINGS',
    ];
    for (const action of candidates) {
      try {
        await IntentLauncher.startActivityAsync(action);
        return { ok: true, message: 'Abrindo configurações de uso de apps.' };
      } catch {
        continue;
      }
    }
    return { ok: false, message: 'Esta versão do Android não expõe a tela de limites.', reason: 'error' };
  } catch (e) {
    return { ok: false, message: `Falha ao abrir limites: ${String(e)}`, reason: 'error' };
  }
}

/* ─────────────────────────────── Foco rígido ─────────────────────────────── */

export interface EscapeRecord {
  startedAt: number;
  awayMs: number;
  reason?: string;
}

/**
 * Detector de fuga: observa o AppState durante uma sessão de foco.
 *
 * Devolve um `stop()` que encerra a vigilância e entrega o total de tempo fora
 * do app. A decisão de cobrar (e com que peso) é da tela, não daqui.
 */
export function watchEscapes(onEscape: (record: EscapeRecord) => void): () => EscapeRecord[] {
  const records: EscapeRecord[] = [];
  if (Platform.OS === 'web') {
    return () => records;
  }
  let leftAt: number | null = null;
  let subscription: { remove: () => void } | null = null;

  void (async () => {
    try {
      const { AppState } = await import('react-native');
      subscription = AppState.addEventListener('change', (state) => {
        if (state === 'background' || state === 'inactive') {
          leftAt = Date.now();
          return;
        }
        if (state === 'active' && leftAt) {
          const record: EscapeRecord = { startedAt: leftAt, awayMs: Date.now() - leftAt };
          leftAt = null;
          records.push(record);
          onEscape(record);
        }
      });
    } catch {
      /* sem AppState: sessão segue sem detector */
    }
  })();

  return () => {
    subscription?.remove();
    return records;
  };
}

/** Formata a duração de ausência para o modal de cobrança. */
export function formatAway(ms: number): string {
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}min${sec ? ` ${sec}s` : ''}`;
}
