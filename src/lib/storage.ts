import AsyncStorage from '@react-native-async-storage/async-storage';
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

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('[MY PRIME] falha ao salvar', key, e);
  }
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
