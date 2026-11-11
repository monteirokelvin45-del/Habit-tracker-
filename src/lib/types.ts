/**
 * Modelo de dados — espelha exatamente as chaves @myprime:* do AsyncStorage.
 */

export type Priority = 'high' | 'normal' | 'low';
export type DayMode = 'normal' | 'minimal' | 'attack' | 'recovery';

export interface User {
  name: string;
  identity: string;
  noMore: string;
  areas: string[];
  createdAt: string;
}

export interface Goal {
  id: string;
  name: string;
  area: string;
  priority: Priority;
  min: string;
  ideal: string;
  excellent: string;
  unit?: string;
  active: boolean;
  archived?: boolean;
  createdAt: string;
  /** Id usado por tarefas antigas quando a meta foi reimportada com outro id. */
  originId?: string;
}

export interface Excuse {
  type: string;
  legitimacy: string;
}

export interface DayTask {
  goalId: string;
  done: boolean;
  note: string;
  doneAt?: string;
  failAt?: string;
  excuse?: Excuse;
  cost?: string;
  recoveryPlan?: string;
}

export interface SleepLog {
  hours: number;
  quality: number;
  blockers: string[];
  bedTime?: string;
  wakeTime?: string;
}

export interface DiaryContext {
  where: string;
  when: string;
  distraction: string;
  trigger: string;
}

export interface Diary {
  promised: string;
  done: string;
  avoided: string;
  blocked: string;
  context: DiaryContext;
  correction: string;
  mood: string;
  sleep: SleepLog;
  food: string;
  focus: number;
  temptation: string;
  relapse: string;
  smallWin: string;
  impulseCost: number;
  emotions: string[];
  photo?: string;
}

export interface ScoreBreakdown {
  regularity: number;
  continuity: number;
  recovery: number;
  honesty: number;
  progress: number;
  total: number;
}

export interface MiddayCheckin {
  priorityDone: boolean;
  energy: number;
  note: string;
  at: string;
}

export interface Day {
  date: string; // YYYY-MM-DD
  energy: { physical: number; mental: number; stress: number };
  mode: DayMode;
  seeded?: boolean;
  tasks: DayTask[];
  diary: Diary;
  score?: ScoreBreakdown;
  closedAt?: string;
  middayCheckin?: MiddayCheckin;
  pomodoros?: { goalId: string; minutes: number; at: string }[];
  /** Registros marcados como "feito" mas sinalizados pela checagem de honestidade. */
  honestyFlags?: { goalId: string; reason: string; resolved: 'confirmed' | 'adjusted' }[];
}

export interface Rule {
  id: string;
  trigger: string;
  action: string;
  reason: string;
  active: boolean;
  timesActivated: number;
  successRate: number;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  criteria: string;
  criteriaType: 'streak' | 'score' | 'consistency';
  target: number;
  current: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  area?: string;
  totalPages: number;
  currentPage: number;
  dailyGoal: { min: number; ideal: number; excellent: number };
  finished: boolean;
  log?: { date: string; pages: number }[];
}

export interface FinanceEntry {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  isImpulse: boolean;
  note: string;
}

export interface WeightEntry {
  id?: string;
  date: string;
  kg: number;
  measurements?: {
    waist?: number;
    chest?: number;
    shoulder?: number;
    arm?: number;
    thigh?: number;
  };
}

export interface Settings {
  morningReminder: string;
  nightReminder: string;
  middayCheckin: boolean;
  middayTime: string;
  streakNotification: boolean;
  haptics: boolean;
  sleepGoalHours: number;
  weightGoalKg?: number;
  targetDailyScore: number;
}

export interface BadgeState {
  id: string;
  unlockedAt: string | null;
}

export interface RulesWeekStat {
  week: string;
  activated: number;
  total: number;
}

export interface AppData {
  onboarded: boolean;
  user: User;
  goals: Goal[];
  days: Day[];
  rules: Rule[];
  rewards: Reward[];
  books: Book[];
  finances: FinanceEntry[];
  weight: WeightEntry[];
  settings: Settings;
  badges: BadgeState[];
  ayanokoji: {
    startDate: string;
    scores: { week: number; selfControl: number; communication: number; discipline: number; observation: number }[];
    tasksDone: Record<string, string[]>;
  };
  weeklyFocus: Record<string, string[]>;
  routeAdjustments: Record<string, string[]>;
}

export const PRIORITY_META: Record<Priority, { emoji: string; label: string; color: string }> = {
  high: { emoji: '🔴', label: 'Prioridade', color: '#FF4444' },
  normal: { emoji: '🟡', label: 'Normal', color: '#FFAA00' },
  low: { emoji: '⚪', label: 'Baixa', color: '#888888' },
};

export const EXCUSE_TYPES = [
  'Falta Real',
  'Má Gestão',
  'Prazer Imediato',
  'Preguiça',
  'Prioridade Errada',
] as const;

export const LEGITIMACY = ['Legítima', 'Fraca', 'Fuga', 'Autoengano', 'Reorganização Real'] as const;

export const MOODS = ['😤', '😟', '😐', '🙂', '😄', '🔥'] as const;

export const EMOTIONS = [
  'Ansioso',
  'Frustrado',
  'Culpado',
  'Orgulhoso',
  'Grato',
  'Entediado',
  'Solitário',
  'Motivado',
  'Irritado',
  'Calmo',
  'Inseguro',
  'Determinado',
  'Triste',
  'Eufórico',
  'Neutro',
] as const;

export const FOOD_OPTIONS = ['Ótima', 'Boa', 'Regular', 'Ruim', 'Péssima'] as const;

export const SLEEP_BLOCKERS = ['Tela', 'Cafeína', 'Estresse', 'Barulho', 'Calor', 'Nada'] as const;

export const FINANCE_CATEGORIES = [
  'Alimentação',
  'Transporte',
  'Lazer',
  'Impulso',
  'Fixo',
  'Investimento',
  'Outros',
] as const;

export const LIFE_AREAS = [
  'Treino',
  'Estudo',
  'Finanças',
  'Leitura',
  'Sono',
  'Relacionamentos',
  'Espiritualidade',
  'Trabalho',
  'Projeto Pessoal',
  'Saúde',
] as const;

export const AREA_EMOJI: Record<string, string> = {
  Treino: '💪',
  Estudo: '🧠',
  Finanças: '💰',
  Leitura: '📚',
  Sono: '😴',
  Relacionamentos: '❤️',
  Espiritualidade: '🙏',
  Trabalho: '💼',
  'Projeto Pessoal': '🎯',
  Saúde: '🏥',
  Ayanokoji: '🎭',
};

export function emptyDiary(): Diary {
  return {
    promised: '',
    done: '',
    avoided: '',
    blocked: '',
    context: { where: '', when: '', distraction: '', trigger: '' },
    correction: '',
    mood: '',
    sleep: { hours: 0, quality: 0, blockers: [] },
    food: '',
    focus: 0,
    temptation: '',
    relapse: '',
    smallWin: '',
    impulseCost: 0,
    emotions: [],
  };
}
