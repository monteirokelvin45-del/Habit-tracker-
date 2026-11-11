import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyDiary } from './types';
import type {
  AppData,
  BadgeState,
  Book,
  Day,
  FinanceEntry,
  Goal,
  Reward,
  Rule,
  Settings,
  User,
  WeightEntry,
} from './types';

export const KEYS = {
  onboarded: '@myprime:onboarded',
  user: '@myprime:user',
  goals: '@myprime:goals',
  days: '@myprime:days',
  rules: '@myprime:rules',
  rewards: '@myprime:rewards',
  books: '@myprime:books',
  finances: '@myprime:finances',
  weight: '@myprime:weight',
  settings: '@myprime:settings',
  badges: '@myprime:badges',
  ayanokoji: '@myprime:ayanokoji',
  weeklyFocus: '@myprime:weeklyFocus',
  routeAdjustments: '@myprime:routeAdjustments',
} as const;

export const DEFAULT_SETTINGS: Settings = {
  morningReminder: '07:00',
  nightReminder: '21:00',
  middayCheckin: true,
  middayTime: '13:00',
  streakNotification: true,
  haptics: true,
  sleepGoalHours: 7.5,
  targetDailyScore: 7,
};

export const EMPTY_USER: User = {
  name: '',
  identity: '',
  noMore: '',
  areas: [],
  createdAt: '',
};

export const EMPTY_DATA: AppData = {
  onboarded: false,
  user: EMPTY_USER,
  goals: [],
  days: [],
  rules: [],
  rewards: [],
  books: [],
  finances: [],
  weight: [],
  settings: DEFAULT_SETTINGS,
  badges: [],
  ayanokoji: { startDate: '', scores: [], tasksDone: {} },
  weeklyFocus: {},
  routeAdjustments: {},
};

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export interface StorageHealth {
  /** Última chave que falhou ao gravar (null = tudo gravou). */
  lastFailedKey: string | null;
  failedWrites: number;
}

export const storageHealth: StorageHealth = { lastFailedKey: null, failedWrites: 0 };

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    storageHealth.lastFailedKey = null;
  } catch (e) {
    // Antes era só um warn no console: o app seguia mostrando o dado como salvo.
    // Agora a falha fica registrada e o Perfil consegue avisar o usuário.
    storageHealth.lastFailedKey = key;
    storageHealth.failedWrites += 1;
    console.warn('[MY PRIME] falha ao salvar', key, e);
  }
}

/**
 * Normaliza dados vindos de fora (backup importado, arquivo editado à mão).
 * Sem isso, uma chave faltando no JSON vira `undefined` no meio do app e
 * quebra em qualquer `.filter`/`.length`.
 */
export function normalizeData(input: Partial<AppData> | null | undefined, base: AppData): AppData {
  const raw = input ?? {};
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  // Dia sem diário/energia quebrava o fechamento e o histórico (crash em computeScore).
  const days = arr<Partial<Day>>(raw.days)
    .filter((d) => !!d && typeof d === 'object' && typeof d.date === 'string')
    .map((d) => ({
      ...d,
      energy: d.energy ?? { physical: 5, mental: 5, stress: 5 },
      mode: d.mode ?? 'normal',
      tasks: Array.isArray(d.tasks) ? d.tasks : [],
      diary: { ...emptyDiary(), ...(d.diary ?? {}) },
    })) as Day[];
  return {
    onboarded: raw.onboarded ?? base.onboarded,
    user: { ...base.user, ...(raw.user ?? {}), areas: arr<string>((raw.user as User | undefined)?.areas) },
    goals: arr<Goal>(raw.goals),
    days,
    rules: arr<Rule>(raw.rules),
    rewards: arr<Reward>(raw.rewards),
    books: arr<Book>(raw.books),
    finances: arr<FinanceEntry>(raw.finances),
    weight: arr<WeightEntry>(raw.weight),
    settings: { ...DEFAULT_SETTINGS, ...base.settings, ...(raw.settings ?? {}) },
    badges: arr<BadgeState>(raw.badges),
    ayanokoji: raw.ayanokoji ?? base.ayanokoji,
    weeklyFocus: raw.weeklyFocus ?? {},
    routeAdjustments: raw.routeAdjustments ?? {},
  };
}

/** Carrega tudo de uma vez (boot do app). */
export async function loadAll(): Promise<AppData> {
  const [
    onboarded,
    user,
    goals,
    days,
    rules,
    rewards,
    books,
    finances,
    weight,
    settings,
    badges,
    ayanokoji,
    weeklyFocus,
    routeAdjustments,
  ] = await Promise.all([
    read<boolean>(KEYS.onboarded, false),
    read<User>(KEYS.user, EMPTY_USER),
    read<Goal[]>(KEYS.goals, []),
    read<Day[]>(KEYS.days, []),
    read<Rule[]>(KEYS.rules, []),
    read<Reward[]>(KEYS.rewards, []),
    read<Book[]>(KEYS.books, []),
    read<FinanceEntry[]>(KEYS.finances, []),
    read<WeightEntry[]>(KEYS.weight, []),
    read<Settings>(KEYS.settings, DEFAULT_SETTINGS),
    read<BadgeState[]>(KEYS.badges, []),
    read<AppData['ayanokoji']>(KEYS.ayanokoji, { startDate: '', scores: [], tasksDone: {} }),
    read<Record<string, string[]>>(KEYS.weeklyFocus, {}),
    read<Record<string, string[]>>(KEYS.routeAdjustments, {}),
  ]);

  return {
    onboarded,
    user,
    goals,
    days,
    rules,
    rewards,
    books,
    finances,
    weight,
    settings: { ...DEFAULT_SETTINGS, ...settings },
    badges,
    ayanokoji: ayanokoji ?? { startDate: '', scores: [], tasksDone: {} },
    weeklyFocus: weeklyFocus ?? {},
    routeAdjustments: routeAdjustments ?? {},
  };
}

/** Persiste uma chave específica. Chamado pelos setters do store. */
export async function persist<K extends keyof typeof KEYS>(field: K, value: unknown): Promise<void> {
  await write(KEYS[field], value);
}

export async function persistMany(entries: [keyof typeof KEYS, unknown][]): Promise<void> {
  await Promise.all(entries.map(([k, v]) => write(KEYS[k], v)));
}

export async function resetAll(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
