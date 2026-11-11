import type { EmotionEntry } from './emotions';
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
  /** Posição escolhida arrastando na tela de Metas. Ausente = ordem de criação. */
  order?: number;
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
  /** Copos de água (250 ml) marcados no dia. `undefined` = não registrado. */
  waterCups?: number;
  /**
   * Extensões por área: cada módulo grava o seu objeto no diário do dia em vez
   * de criar chave nova no storage. Tipados como `unknown` no modelo base e
   * estreitados pelos módulos que os leem (`StudyBlock[]`, `WorkoutSession`…).
   */
  study?: unknown;
  studyPlan?: unknown;
  workout?: unknown;
  book?: unknown;
  project?: unknown;
  distraction?: string;
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
  /** Resposta "parcial": não é sim nem não, e não pode virar "não feita". */
  partial?: boolean;
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
  /**
   * Só o que a pessoa MUDOU no cronograma (chave do bloco → horário `HH:MM`).
   * Bloco sem entrada aqui usa o horário sugerido; o mapa nunca é tratado como
   * registro do que aconteceu.
   */
  scheduleOverrides?: Record<string, string>;
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

export type ThemeId = 'emerald' | 'golden' | 'cyberpunk' | 'ocean' | 'neonBlue' | 'softGlass' | 'fitPulse';

export interface Settings {
  /** Tema visual ativo (Perfil → Aparência). */
  theme?: ThemeId;
  /** Sincronizar o cronograma do dia com a agenda nativa do celular. */
  syncCalendar?: boolean;
  /** Criar alarmes nativos no Relógio do Android. */
  nativeAlarms?: boolean;
  /** Detector de fuga durante sessões de foco (AppState). */
  escapeDetector?: boolean;
  morningReminder: string;
  nightReminder: string;
  middayCheckin: boolean;
  middayTime: string;
  streakNotification: boolean;
  haptics: boolean;
  sleepGoalHours: number;
  /** Meta de foco diária em minutos (dashboard "Foco"). */
  focusGoalMinutes?: number;
  weightGoalKg?: number;
  /** Altura em cm — necessária para IMC. Sem ela, o IMC é "Sem dado". */
  heightCm?: number;
  targetDailyScore: number;
  /**
   * 4 últimos dígitos de um cartão, se o usuário quiser identificar a conta no
   * cartão de saldo. Fica só no aparelho (AsyncStorage) — o app não guarda
   * número completo, validade nem CVV, e não envia nada para servidor.
   */
  cardLast4?: string;
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
  /** Diário de emoções (1–3 registros/dia) — ver `lib/emotions.ts`. */
  emotions: EmotionEntry[];
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

/**
 * Diário completo a partir de qualquer coisa (dia antigo, backup editado, JSON de
 * outra versão). Sem isso, um `day.diary` ausente derrubava `computeScore`
 * ("Cannot read properties of undefined (reading 'context')") e abrir um dia
 * antigo no histórico fechava a tela.
 */
export function normalizeDiary(input: unknown): Diary {
  const base = emptyDiary();
  if (!input || typeof input !== 'object') return base;
  const d = input as Partial<Diary>;
  const ctx = (d.context ?? {}) as Partial<DiaryContext>;
  const sleep = (d.sleep ?? {}) as Partial<SleepLog>;
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  return {
    promised: str(d.promised),
    done: str(d.done),
    avoided: str(d.avoided),
    blocked: str(d.blocked),
    context: {
      where: str(ctx.where),
      when: str(ctx.when),
      distraction: str(ctx.distraction),
      trigger: str(ctx.trigger),
    },
    correction: str(d.correction),
    mood: str(d.mood),
    sleep: {
      hours: num(sleep.hours),
      quality: num(sleep.quality),
      blockers: Array.isArray(sleep.blockers) ? sleep.blockers.filter((b): b is string => typeof b === 'string') : [],
      bedTime: typeof sleep.bedTime === 'string' ? sleep.bedTime : undefined,
      wakeTime: typeof sleep.wakeTime === 'string' ? sleep.wakeTime : undefined,
    },
    food: str(d.food),
    focus: num(d.focus),
    temptation: str(d.temptation),
    relapse: str(d.relapse),
    smallWin: str(d.smallWin),
    impulseCost: num(d.impulseCost),
    emotions: Array.isArray(d.emotions) ? d.emotions.filter((e): e is string => typeof e === 'string') : [],
    photo: typeof d.photo === 'string' ? d.photo : undefined,
    // `undefined` continua sendo "não registrado" — 0 é um registro válido.
    waterCups: typeof d.waterCups === 'number' && Number.isFinite(d.waterCups) ? d.waterCups : undefined,
    // Extensões por área atravessam o backup como vieram (cada módulo valida).
    study: d.study,
    studyPlan: d.studyPlan,
    workout: d.workout,
    book: d.book,
    project: d.project,
    distraction: typeof d.distraction === 'string' ? d.distraction : '',
  };
}

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
