/**
 * Normalização de dado que vem de FORA (storage antigo, backup editado à mão,
 * importação, snapshot).
 *
 * Por que este arquivo existe: o boot só cuidava de `days`, `goals` e das listas
 * sanitizadas. O resto — `settings`, `user`, `ayanokoji`, `weeklyFocus`, o
 * conteúdo do diário — entrava cru. Um backup com `waterCups: "dois"`,
 * `middayCheckin: "sim"`, `theme: "nao-existe"` ou `scores: "x"` passava pelo
 * `normalizeData` e só quebrava depois, na tela, longe da causa.
 *
 * Regra que vale aqui:
 *  - reparar o que tem conserto (`"82,4"` → `82.4`, `"sete"` → 0);
 *  - DESCARTAR o que não tem (número fora da faixa plausível, item sem id);
 *  - nunca inventar registro: campo ausente vira o default do modelo, não um
 *    valor "médio" que pareça dado do usuário.
 */
import { emptyDiary, type Day, type Diary, type Settings, type User } from './types';

/* ───────────────────────────── primitivas ───────────────────────────── */

/** Número finito dentro de uma faixa; qualquer outra coisa vira `fallback`. */
export function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** `null` quando o valor não é um número finito na faixa — usado onde "sem dado" é diferente de 0. */
export function numOrNull(value: unknown, min = -Infinity, max = Infinity): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value.replace(',', '.')) : NaN;
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** Texto limpo. `null`/`undefined` → `''`; número vira texto (não vira "undefined"). */
export function str(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

export function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1) return true;
  if (value === 'false' || value === 0) return false;
  return fallback;
}

/** Lista de objetos descartando entradas que não são objeto (um `null` no meio derrubava `.map`). */
export function objList<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => !!v && typeof v === 'object' && !Array.isArray(v));
}

/** Lista de strings, descartando o resto. */
export function strList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

/** Chave de dia `YYYY-MM-DD` válida. Backup com `"ontem"` ou `null` é descartado. */
export function isDayKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Horário `HH:MM` 24h. Número (como `1300`) não é horário: volta o default. */
export function timeOfDay(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !/^\d{1,2}:\d{2}$/.test(value)) return fallback;
  const [h, m] = value.split(':').map(Number);
  if ((h ?? 99) > 23 || (m ?? 99) > 59) return fallback;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/* ───────────────────────────── modelos ───────────────────────────── */

export const THEME_IDS = [
  'emerald',
  'golden',
  'cyberpunk',
  'ocean',
  'neonBlue',
  'softGlass',
  'fitPulse',
  /** Atmosfera do AI Copilot. */
  'copilot',
] as const;

/**
 * Settings: campo por campo, com faixa plausível.
 *
 * `merge` sozinho não bastava — o valor ruim do backup vencia o default. Um
 * `targetDailyScore: "7"` virava comparação de texto e um `middayCheckin: "sim"`
 * (string) era verdadeiro por acidente, sem nunca ser booleano.
 */
export function normalizeSettings(raw: unknown, base: Settings): Settings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const theme = THEME_IDS.includes(s.theme as (typeof THEME_IDS)[number]) ? (s.theme as Settings['theme']) : base.theme;
  const heightRaw = numOrNull(s.heightCm, 80, 260);
  return {
    ...base,
    theme,
    syncCalendar: bool(s.syncCalendar, base.syncCalendar ?? false),
    nativeAlarms: bool(s.nativeAlarms, base.nativeAlarms ?? false),
    escapeDetector: bool(s.escapeDetector, base.escapeDetector ?? true),
    morningReminder: timeOfDay(s.morningReminder, base.morningReminder),
    nightReminder: timeOfDay(s.nightReminder, base.nightReminder),
    middayCheckin: bool(s.middayCheckin, base.middayCheckin),
    middayTime: timeOfDay(s.middayTime, base.middayTime),
    streakNotification: bool(s.streakNotification, base.streakNotification),
    haptics: bool(s.haptics, base.haptics),
    sleepGoalHours: num(s.sleepGoalHours, base.sleepGoalHours, 1, 16),
    focusGoalMinutes: num(s.focusGoalMinutes, base.focusGoalMinutes ?? 240, 0, 1440),
    targetDailyScore: num(s.targetDailyScore, base.targetDailyScore, 0, 10),
    weightGoalKg: numOrNull(s.weightGoalKg, 20, 400) ?? base.weightGoalKg,
    // Altura fora da faixa é dado ilegível: some, e o IMC volta a "Sem dado".
    heightCm: heightRaw ?? undefined,
    // Meta de água e macros são DECLARADAS pela pessoa: só entram em faixa
    // plausível, senão a barra de hidratação vira ficção.
    waterGoalCups: numOrNull(s.waterGoalCups, 1, 40) ?? undefined,
    proteinPct: numOrNull(s.proteinPct, 0, 100) ?? undefined,
    carbsPct: numOrNull(s.carbsPct, 0, 100) ?? undefined,
    fatPct: numOrNull(s.fatPct, 0, 100) ?? undefined,
  };
}

/** Usuário: texto em texto, lista em lista. Nome numérico não vira "42". */
export function normalizeUser(raw: unknown, base: User): User {
  const u = (raw ?? {}) as Record<string, unknown>;
  return {
    name: str(u.name, base.name),
    identity: str(u.identity, base.identity),
    noMore: str(u.noMore, base.noMore),
    areas: strList(u.areas),
    createdAt: str(u.createdAt, base.createdAt),
  };
}

/** Contexto do diário (onde/quando/distração/gatilho). */
export function normalizeDiaryContext(raw: unknown, base: Diary['context']): Diary['context'] {
  const c = (raw ?? {}) as Record<string, unknown>;
  return {
    where: str(c.where, base.where),
    when: str(c.when, base.when),
    distraction: str(c.distraction, base.distraction),
    trigger: str(c.trigger, base.trigger),
  };
}

/**
 * Diário completo.
 *
 * O `...input` antigo deixava passar `promised: 3` (número), `food: 42` e
 * `sleep: { hours: "sete" }`. Cada um desses só quebrava na tela que o lia —
 * `.trim is not a function`, `NaN` no gráfico de sono.
 */
export function normalizeDiary(raw: unknown): Diary {
  const base = emptyDiary();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  const d = raw as Record<string, unknown>;
  const sleep = (d.sleep ?? {}) as Record<string, unknown>;

  return {
    ...base,
    promised: str(d.promised),
    done: str(d.done),
    avoided: str(d.avoided),
    blocked: str(d.blocked),
    context: normalizeDiaryContext(d.context, base.context),
    correction: str(d.correction),
    mood: str(d.mood),
    sleep: {
      hours: num(sleep.hours, 0, 0, 24),
      quality: num(sleep.quality, 0, 0, 10),
      blockers: strList(sleep.blockers),
      ...(typeof sleep.bedTime === 'string' ? { bedTime: sleep.bedTime } : {}),
      ...(typeof sleep.wakeTime === 'string' ? { wakeTime: sleep.wakeTime } : {}),
    },
    food: str(d.food),
    focus: num(d.focus, 0, 0, 1440),
    temptation: str(d.temptation),
    relapse: str(d.relapse),
    smallWin: str(d.smallWin),
    impulseCost: num(d.impulseCost, 0, 0),
    emotions: strList(d.emotions),
    // Extensões por área: aqui só se garante o TIPO (o módulo de cada uma
    // normaliza o conteúdo). Texto solto vira ausência, não objeto falso.
    study: Array.isArray(d.study) ? d.study : undefined,
    studyPlan: d.studyPlan && typeof d.studyPlan === 'object' ? d.studyPlan : undefined,
    workout: d.workout && typeof d.workout === 'object' && !Array.isArray(d.workout) ? d.workout : undefined,
    book: d.book && typeof d.book === 'object' && !Array.isArray(d.book) ? d.book : undefined,
    project: d.project && typeof d.project === 'object' ? d.project : undefined,
    distraction: str(d.distraction) || undefined,
    // Água: número plausível ou ausência (nunca "dois" nem 99 copos).
    waterCups: numOrNull(d.waterCups, 0, 40) ?? undefined,
    ...(typeof d.photo === 'string' ? { photo: d.photo } : {}),
  };
}

/** Dia: data válida, energia numérica, tarefas limpas, diário normalizado. */
export function normalizeDayFull(input: Partial<Day>, fallbackDate = ''): Day {
  const raw = (input ?? {}) as Record<string, unknown>;
  const energy = (raw.energy ?? {}) as Record<string, unknown>;
  const score = raw.score as Record<string, unknown> | undefined;
  const mode = str(raw.mode);
  const modes = ['normal', 'minimal', 'attack', 'recovery'];

  return {
    ...(raw as Partial<Day>),
    date: isDayKey(raw.date) ? raw.date : fallbackDate,
    // `pomodoros`, `scheduleOverrides`, `honestyFlags`, `closedAt`, `middayCheckin`
    // etc. vêm do spread acima; o que precisa de crivo é o campo abaixo.
    energy: {
      physical: num(energy.physical, 5, 0, 10),
      mental: num(energy.mental, 5, 0, 10),
      stress: num(energy.stress, 5, 0, 10),
    },
    mode: (modes.includes(mode) ? mode : 'normal') as Day['mode'],
    // `...t` primeiro: a tarefa carrega justificativa de falha (`excuse`), custo e
    // plano de recuperação — reconstruir o objeto do zero apagava a COBRANÇA que
    // o app faz questão de guardar.
    tasks: objList<Record<string, unknown>>(raw.tasks)
      .filter((t) => typeof t.goalId === 'string' && t.goalId.length > 0)
      .map((t) => ({
        ...t,
        goalId: t.goalId as string,
        done: bool(t.done, false),
        note: str(t.note),
        ...(typeof t.doneAt === 'string' ? { doneAt: t.doneAt } : {}),
        ...(typeof t.failAt === 'string' ? { failAt: t.failAt } : {}),
        ...(t.excuse && typeof t.excuse === 'object' ? { excuse: t.excuse } : {}),
        ...(typeof t.cost === 'string' ? { cost: t.cost } : {}),
        ...(typeof t.recoveryPlan === 'string' ? { recoveryPlan: t.recoveryPlan } : {}),
      })),
    diary: normalizeDiary(raw.diary),
    // Score é recalculado ao fechar o dia; um score de texto no backup vira
    // ausente (nunca `NaN` no gráfico).
    ...(score && typeof score.total === 'number' && Number.isFinite(score.total)
      ? {
          score: {
            regularity: num(score.regularity, 0, 0, 10),
            continuity: num(score.continuity, 0, 0, 10),
            recovery: num(score.recovery, 0, 0, 10),
            honesty: num(score.honesty, 0, 0, 10),
            progress: num(score.progress, 0, 0, 10),
            total: num(score.total, 0, 0, 10),
          },
        }
      : { score: undefined }),
    pomodoros: objList<Record<string, unknown>>(raw.pomodoros).map((p) => ({
      goalId: str(p.goalId) || undefined,
      minutes: num(p.minutes, 0, 0, 600),
      at: str(p.at),
    })),
  } as Day;
}

/** Ayanokoji: pontuações semanais numéricas (um `scores: "x"` derrubava a tela). */
export function normalizeAyanokoji<T extends { startDate: string; scores: unknown; tasksDone: unknown }>(raw: unknown, base: T): T {
  const a = (raw ?? {}) as Record<string, unknown>;
  const scores = objList<Record<string, unknown>>(a.scores).map((s) => ({
    week: num(s.week, 0, 0, 10),
    selfControl: num(s.selfControl, 0, 0, 10),
    communication: num(s.communication, 0, 0, 10),
    discipline: num(s.discipline, 0, 0, 10),
    observation: num(s.observation, 0, 0, 10),
  }));
  const tasksDone: Record<string, string[]> = {};
  if (a.tasksDone && typeof a.tasksDone === 'object' && !Array.isArray(a.tasksDone)) {
    for (const [k, v] of Object.entries(a.tasksDone as Record<string, unknown>)) {
      tasksDone[k] = strList(v);
    }
  }
  return {
    ...base,
    startDate: str(a.startDate, base.startDate),
    scores,
    tasksDone,
  } as T;
}

/** Mapa `data → string[]` (weeklyFocus, routeAdjustments). */
export function normalizeStringMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (!k) continue;
    out[k] = strList(v);
  }
  return out;
}

/** Selos: id obrigatório, data de desbloqueio só se for texto. */
export function normalizeBadges(value: unknown): { id: string; unlockedAt: string | null }[] {
  return objList<Record<string, unknown>>(value)
    .filter((b) => typeof b.id === 'string' && b.id.length > 0)
    .map((b) => ({ id: b.id as string, unlockedAt: typeof b.unlockedAt === 'string' ? b.unlockedAt : null }));
}
