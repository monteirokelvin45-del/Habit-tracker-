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
  theme: 'emerald',
  syncCalendar: false,
  nativeAlarms: false,
  escapeDetector: true,
  morningReminder: '07:00',
  nightReminder: '21:00',
  middayCheckin: true,
  middayTime: '13:00',
  streakNotification: true,
  haptics: true,
  sleepGoalHours: 7.5,
  focusGoalMinutes: 240,
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

/**
 * Chaves espelhadas num snapshot automático. Se `days` um dia voltar vazio (bug de
 * migração, multiRemove acidental, storage corrompido), o app consegue recuperar a
 * última versão boa em vez de começar do zero.
 */
const SNAPSHOT_KEYS = ['days', 'goals', 'user', 'settings', 'badges'] as const;
export const SNAPSHOT_PREFIX = '@myprime:backup:';

async function write(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
    storageHealth.lastFailedKey = null;
    await mirror(key, value);
  } catch (e) {
    // Antes era só um warn no console: o app seguia mostrando o dado como salvo.
    // Agora a falha fica registrada e o Perfil consegue avisar o usuário.
    storageHealth.lastFailedKey = key;
    storageHealth.failedWrites += 1;
    console.warn('[MY PRIME] falha ao salvar', key, e);
  }
}

/** Espelha a última versão BOA de cada chave protegida (nunca grava lista vazia). */
async function mirror(key: string, value: unknown): Promise<void> {
  const field = (Object.keys(KEYS) as (keyof typeof KEYS)[]).find((k) => KEYS[k] === key);
  if (!field || !(SNAPSHOT_KEYS as readonly string[]).includes(field)) return;
  if (Array.isArray(value) && value.length === 0) return;
  try {
    await AsyncStorage.setItem(
      `${SNAPSHOT_PREFIX}${field}`,
      JSON.stringify({ at: new Date().toISOString(), value }),
    );
  } catch {
    /* espelho é best-effort: nunca deve atrapalhar a gravação principal */
  }
}

/**
 * Versão do formato persistido. Fica gravada no backup para que uma migração
 * futura saiba o que está lendo (o app aceita qualquer versão, mas registra).
 */
export const SCHEMA_VERSION = 1;

/** Dia vindo de storage/backup/snapshot: sempre com energia, tarefas e diário. */
export function normalizeDay(input: Partial<Day>): Day {
  return {
    ...input,
    date: String(input.date),
    energy: input.energy ?? { physical: 5, mental: 5, stress: 5 },
    mode: input.mode ?? 'normal',
    tasks: (Array.isArray(input.tasks) ? input.tasks : [])
      .filter((t): t is NonNullable<typeof t> => !!t && typeof t === 'object' && typeof t.goalId === 'string')
      .map((t) => ({ ...t, done: !!t.done, note: t.note ?? '' })),
    diary: { ...emptyDiary(), ...(input.diary ?? {}) },
  } as Day;
}

const PRIORITIES = ['high', 'normal', 'low'] as const;

/** Meta de storage antigo/backup: sem defaults ela some do checklist ou quebra a tela. */
export function sanitizeGoal(input: Partial<Goal>): Goal {
  const g = input as Partial<Goal> & { priority?: string };
  return {
    id: String(g.id ?? ''),
    name: String(g.name ?? 'Meta sem nome'),
    area: String(g.area ?? 'Projeto Pessoal'),
    // `priority` ausente deixava `PRIORITY_META[undefined].emoji` fatal no checklist.
    priority: (PRIORITIES as readonly string[]).includes(g.priority ?? '')
      ? (g.priority as Goal['priority'])
      : 'normal',
    min: String(g.min ?? '10min'),
    ideal: String(g.ideal ?? '30min'),
    excellent: String(g.excellent ?? '1h'),
    // `active` ausente era falsy: a meta desaparecia do checklist sem aviso.
    active: g.active ?? true,
    archived: g.archived ?? false,
    ...(g.originId ? { originId: g.originId } : {}),
    createdAt: g.createdAt ?? new Date().toISOString(),
  };
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
    .map(normalizeDay);
  return {
    onboarded: raw.onboarded ?? base.onboarded,
    user: { ...base.user, ...(raw.user ?? {}), areas: arr<string>((raw.user as User | undefined)?.areas) },
    goals: arr<Partial<Goal> | null>(raw.goals)
      .filter((g): g is Partial<Goal> => !!g && typeof g === 'object' && typeof g.id === 'string')
      .map(sanitizeGoal),
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

export interface SnapshotInfo {
  key: string;
  field: string;
  at: string;
  count: number;
}

async function readSnapshot(field: string): Promise<{ at: string; value: unknown } | null> {
  return read<{ at: string; value: unknown } | null>(`${SNAPSHOT_PREFIX}${field}`, null);
}

/** Lista os snapshots existentes (o Perfil mostra a data e a quantidade recuperável). */
export async function listSnapshots(): Promise<SnapshotInfo[]> {
  const entries = await Promise.all(
    SNAPSHOT_KEYS.map(async (field): Promise<SnapshotInfo | null> => {
      const snap = await readSnapshot(field);
      if (!snap) return null;
      const value = snap.value;
      return {
        key: KEYS[field],
        field: String(field),
        at: snap.at,
        count: Array.isArray(value) ? value.length : value ? 1 : 0,
      };
    }),
  );
  return entries.filter((e): e is SnapshotInfo => !!e && (e.field !== 'days' || e.count > 0));
}

/**
 * Recupera os dias (e metas, se vieram junto) do último snapshot bom.
 * Usado quando o boot encontra 0 dias mas existe cópia com histórico — cenário de
 * perda de dados silenciosa, em que antes o app simplesmente abria vazio.
 */
export async function restoreSnapshots(): Promise<{ days: Day[]; goals: Goal[] } | null> {
  const [daysSnap, goalsSnap] = await Promise.all([readSnapshot('days'), readSnapshot('goals')]);
  const days = Array.isArray(daysSnap?.value) ? (daysSnap!.value as Day[]) : [];
  if (!days.length) return null;
  const goals = Array.isArray(goalsSnap?.value) ? (goalsSnap!.value as Goal[]) : [];
  return { days: days.map((d) => normalizeDay(d)), goals: goals.map(sanitizeGoal) };
}

export async function discardSnapshots(): Promise<void> {
  await AsyncStorage.multiRemove(SNAPSHOT_KEYS.map((f) => `${SNAPSHOT_PREFIX}${f}`));
}


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
