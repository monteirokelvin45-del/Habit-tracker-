import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  EMPTY_DATA,
  persist,
  persistMany,
  resetAll,
} from './storage';
import type {
  AppData,
  Book,
  Day,
  DayMode,
  Diary,
  FinanceEntry,
  Goal,
  Priority,
  Reward,
  Rule,
  Settings,
  User,
  WeightEntry,
} from './types';
import { emptyDiary } from './types';
import { addDays, nowHHmm, todayKey } from './date';
import { buildChecklist, computeScore, taskKeyFor } from './score';
import { evaluateBadges } from './badges';
import { evaluateRewards } from './rewards';
import { newId } from './id';
import type { ImportSummary } from './importer';

export type LoadState = 'idle' | 'loading' | 'ready';

export interface StoreState extends AppData {
  status: LoadState;
  /** true depois do splash de 2s. */
  booted: boolean;
  load: () => Promise<void>;
  setBooted: () => void;

  finishOnboarding: (payload: {
    user: User;
    areas: string[];
    goals: Goal[];
    settings: Partial<Settings>;
  }) => Promise<void>;

  ensureDay: (date?: string) => Day;
  setEnergy: (date: string, energy: { physical: number; mental: number; stress: number }) => void;
  setMode: (date: string, mode: DayMode) => void;
  toggleTask: (date: string, goalId: string, done: boolean) => void;
  setTaskNote: (date: string, goalId: string, note: string) => void;
  setTaskExcuse: (
    date: string,
    goalId: string,
    data: { type: string; legitimacy: string; cost: string; recoveryPlan: string },
  ) => void;
  addPomodoro: (date: string, goalId: string, minutes: number) => void;
  setMidday: (date: string, data: { priorityDone: boolean; energy: number; note: string }) => void;
  closeDay: (date: string, diary: Diary) => Day;
  resolveHonestyFlag: (date: string, goalId: string, resolution: 'confirmed' | 'adjusted') => void;
  reopenDay: (date: string) => void;

  upsertGoal: (goal: Goal) => void;
  archiveGoal: (id: string) => void;
  deleteGoal: (id: string) => void;

  updateUser: (patch: Partial<User>) => void;
  updateSettings: (patch: Partial<Settings>) => void;

  upsertRule: (rule: Rule) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  markRuleActivated: (id: string, success: boolean) => void;

  addReward: (reward: Reward) => void;
  deleteReward: (id: string) => void;
  refreshRewards: () => void;

  addBook: (book: Book) => void;
  updateBook: (book: Book) => void;
  deleteBook: (id: string) => void;

  addFinance: (entry: FinanceEntry) => void;
  deleteFinance: (id: string) => void;

  addWeight: (entry: WeightEntry) => void;
  deleteWeight: (date: string) => void;

  setAyanokojiScore: (week: number, scores: { selfControl: number; communication: number; discipline: number; observation: number }) => void;
  toggleAyanokojiTask: (date: string, taskId: string) => void;
  setWeeklyFocus: (weekStart: string, items: string[]) => void;
  setRouteAdjustment: (monthKey: string, items: string[]) => void;

  importGoals: (goals: Goal[], areas: string[]) => void;
  applyImport: (summary: ImportSummary) => Promise<void>;
  hardReset: () => Promise<void>;
}

/** Aceita YYYY-MM-DD ou ISO e devolve ISO completo (ou null). */
function toIsoCreatedAt(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00`).toISOString();
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function makeDay(date: string, goals: Goal[], mode: DayMode = 'normal'): Day {
  return {
    date,
    energy: { physical: 5, mental: 5, stress: 5 },
    mode,
    tasks: buildChecklist(goals, mode).map((item) => ({
      goalId: taskKeyFor(item),
      done: false,
      note: '',
    })),
    diary: emptyDiary(),
  };
}

export const useStore = create<StoreState>((set, get) => ({
  ...EMPTY_DATA,
  status: 'idle',
  booted: false,

  async load() {
    set({ status: 'loading' });
    const { loadAll } = await import('./storage');
    const data = await loadAll();
    set({ ...data, status: 'ready' });
  },

  setBooted() {
    set({ booted: true });
  },

  async finishOnboarding({ user, areas, goals, settings }) {
    const current = get();
    const mergedSettings: Settings = { ...DEFAULT_SETTINGS, ...current.settings, ...settings };
    const mergedUser: User = {
      ...user,
      name: user.name || current.user.name,
      identity: user.identity || current.user.identity,
      noMore: user.noMore || current.user.noMore,
      areas: Array.from(new Set([...(user.areas ?? []), ...areas, ...current.user.areas])),
      // onboarding grava todayKey() ("2026-11-10"); normaliza para ISO completo.
      createdAt: toIsoCreatedAt(user.createdAt) || current.user.createdAt || new Date().toISOString(),
    };

    // Metas vindas de um plano importado não podem ser perdidas no onboarding.
    const key = (g: Goal) => `${g.area}|${g.name.toLowerCase().trim()}`;
    const seen = new Set(goals.map(key));
    const mergedGoals = [...goals, ...current.goals.filter((g) => !seen.has(key(g)))];

    const ayanokoji = current.ayanokoji.startDate
      ? current.ayanokoji
      : { startDate: todayKey(), scores: [], tasksDone: {} };

    set({
      onboarded: true,
      user: mergedUser,
      goals: mergedGoals,
      settings: mergedSettings,
      ayanokoji,
    });
    await persistMany([
      ['onboarded', true],
      ['user', mergedUser],
      ['goals', mergedGoals],
      ['settings', mergedSettings],
      ['ayanokoji', ayanokoji],
    ]);
  },

  ensureDay(date = todayKey()) {
    const state = get();
    const existing = state.days.find((d) => d.date === date);
    if (existing) return existing;
    const day = makeDay(date, state.goals);
    const days = [...state.days, day].sort((a, b) => (a.date < b.date ? -1 : 1));
    set({ days });
    void persist('days', days);
    return day;
  },

  setEnergy(date, energy) {
    const days = get().days.map((d) => (d.date === date ? { ...d, energy } : d));
    set({ days });
    void persist('days', days);
  },

  setMode(date, mode) {
    const state = get();
    const base = state.days.find((d) => d.date === date) ?? makeDay(date, state.goals, mode);
    const restored: Day['tasks'] = buildChecklist(state.goals, mode).map((item) => {
      const key = taskKeyFor(item);
      const previous = base.tasks.find((t) => t.goalId === key);
      return (
        previous ?? {
          goalId: key,
          done: false,
          note: '',
        }
      );
    });
    // Preserva tarefas extras concluídas de outros modos (histórico do dia).
    const carry = base.tasks.filter((t) => !restored.some((r) => r.goalId === t.goalId));
    const merged: Day = { ...base, mode, tasks: [...restored, ...carry] };
    const days = state.days.some((d) => d.date === date)
      ? state.days.map((d) => (d.date === date ? merged : d))
      : [...state.days, merged].sort((a, b) => (a.date < b.date ? -1 : 1));
    set({ days });
    void persist('days', days);
  },

  toggleTask(date, goalId, done) {
    const state = get();
    // Dia já encerrado é registro fechado: alterar tarefa depois mudaria o passado.
    const closed = state.days.find((d) => d.date === date)?.closedAt;
    if (closed && date !== todayKey()) return;
    let day = state.days.find((d) => d.date === date);
    if (!day) day = makeDay(date, state.goals);
    const exists = day.tasks.some((t) => t.goalId === goalId);
    const tasks = exists
      ? day.tasks.map((t) =>
          t.goalId === goalId
            ? {
                ...t,
                done,
                doneAt: done ? nowHHmm() : undefined,
                failAt: done ? undefined : nowHHmm(),
                excuse: done ? t.excuse : t.excuse,
              }
            : t,
        )
      : [...day.tasks, { goalId, done, note: '', doneAt: done ? nowHHmm() : undefined, failAt: done ? undefined : nowHHmm() }];
    let updated: Day = { ...day, tasks };

    const withDay = state.days.some((d) => d.date === date)
      ? state.days.map((d) => (d.date === date ? updated : d))
      : [...state.days, updated].sort((a, b) => (a.date < b.date ? -1 : 1));

    // Mantém o score vivo quando o dia já foi fechado (dashboard mostra progresso real).
    // O cálculo PRECISA entrar no array persistido — antes ficava só no objeto local.
    if (updated.score) {
      updated = {
        ...updated,
        score: computeScore({
          day: updated,
          goals: state.goals,
          previousDays: withDay.filter((d) => d.date < date),
        }),
      };
    }
    const days = withDay.map((d) => (d.date === date ? updated : d));

    set({ days });
    void persist('days', days);
  },

  setTaskNote(date, goalId, note) {
    const days = get().days.map((d) =>
      d.date === date ? { ...d, tasks: d.tasks.map((t) => (t.goalId === goalId ? { ...t, note } : t)) } : d,
    );
    set({ days });
    void persist('days', days);
  },

  setTaskExcuse(date, goalId, data) {
    const state = get();
    const next = state.days.map((d) =>
      d.date === date
        ? {
            ...d,
            tasks: d.tasks.map((t) =>
              t.goalId === goalId
                ? {
                    ...t,
                    done: false,
                    doneAt: undefined,
                    failAt: t.failAt ?? nowHHmm(),
                    excuse: { type: data.type, legitimacy: data.legitimacy },
                    cost: data.cost,
                    recoveryPlan: data.recoveryPlan,
                  }
                : t,
            ),
          }
        : d,
    );
    // Registrar a falha muda o dia: se já havia score, ele precisa refletir a falha.
    const days = next.map((d) =>
      d.date === date && d.score
        ? {
            ...d,
            score: computeScore({
              day: d,
              goals: state.goals,
              previousDays: next.filter((x) => x.date < date),
            }),
          }
        : d,
    );
    set({ days });
    void persist('days', days);
  },

  addPomodoro(date, goalId, minutes) {
    const days = get().days.map((d) =>
      d.date === date
        ? { ...d, pomodoros: [...(d.pomodoros ?? []), { goalId, minutes, at: nowHHmm() }] }
        : d,
    );
    set({ days });
    void persist('days', days);
  },

  setMidday(date, data) {
    const days = get().days.map((d) =>
      d.date === date ? { ...d, middayCheckin: { ...data, at: nowHHmm() } } : d,
    );
    set({ days });
    void persist('days', days);
  },

  closeDay(date, diary) {
    const state = get();
    const existing = state.days.find((d) => d.date === date) ?? makeDay(date, state.goals);
    const draft: Day = { ...existing, diary, closedAt: new Date().toISOString() };
    const previousDays = state.days.filter((d) => d.date < date);
    const score = computeScore({ day: draft, goals: state.goals, previousDays });
    const closed: Day = { ...draft, score };
    const days = state.days.some((d) => d.date === date)
      ? state.days.map((d) => (d.date === date ? closed : d)).sort((a, b) => (a.date < b.date ? -1 : 1))
      : [...state.days, closed].sort((a, b) => (a.date < b.date ? -1 : 1));

    const nextDays = [...days];
    // Abre o dia seguinte já com o modo sugerido (recuperação ou normal).
    const tomorrow = addDays(date, 1);
    if (!nextDays.some((d) => d.date === tomorrow)) {
      nextDays.push(makeDay(tomorrow, state.goals, score.total < 4 ? 'recovery' : 'normal'));
    }

    const withRewards = evaluateRewards({ ...state, days: nextDays });
    const badges = evaluateBadges({ ...state, days: nextDays, rewards: withRewards });

    set({ days: nextDays, rewards: withRewards, badges });
    void persistMany([
      ['days', nextDays],
      ['rewards', withRewards],
      ['badges', badges],
    ]);
    return closed;
  },

  resolveHonestyFlag(date, goalId, resolution) {
    const state = get();
    const withFlag = (d: Day, resolved: 'confirmed' | 'adjusted'): Day => {
      const existing = d.honestyFlags ?? [];
      const has = existing.some((f) => f.goalId === goalId);
      return {
        ...d,
        honestyFlags: has
          ? existing.map((f) => (f.goalId === goalId ? { ...f, resolved } : f))
          : // A checagem é calculada na hora: se ainda não havia flag gravada, criamos.
            [...existing, { goalId, reason: 'resposta do usuário', resolved }],
      };
    };

    const next = state.days.map((d) => (d.date === date ? withFlag(d, resolution) : d));
    // Responder a checagem muda a honestidade — e a honestidade muda o score do dia fechado.
    const days = next.map((d) =>
      d.date === date && d.score
        ? { ...d, score: computeScore({ day: d, goals: state.goals, previousDays: next.filter((x) => x.date < date) }) }
        : d,
    );
    set({ days });
    void persist('days', days);
  },

  reopenDay(date) {
    const days = get().days.map((d) =>
      d.date === date ? { ...d, closedAt: undefined } : d,
    );
    set({ days });
    void persist('days', days);
  },

  upsertGoal(goal) {
    const state = get();
    const goals = state.goals.some((g) => g.id === goal.id)
      ? state.goals.map((g) => (g.id === goal.id ? goal : g))
      : [...state.goals, goal];
    // Adiciona a nova tarefa ao checklist de hoje se a meta estiver ativa.
    const today = todayKey();
    const days = state.days.map((d) => {
      if (d.date !== today || !goal.active || goal.archived) return d;
      if (d.tasks.some((t) => t.goalId === goal.id)) return d;
      return { ...d, tasks: [...d.tasks, { goalId: goal.id, done: false, note: '' }] };
    });
    set({ goals, days });
    void persistMany([
      ['goals', goals],
      ['days', days],
    ]);
  },

  archiveGoal(id) {
    const state = get();
    const target = state.goals.find((g) => g.id === id);
    const archived = !target?.archived;
    const goals = state.goals.map((g) => (g.id === id ? { ...g, archived, active: archived ? false : true } : g));
    const today = todayKey();
    const days = state.days.map((d) => {
      if (d.date !== today) return d;
      if (archived) return { ...d, tasks: d.tasks.filter((t) => t.goalId !== id) };
      if (d.tasks.some((t) => t.goalId === id)) return d;
      return { ...d, tasks: [...d.tasks, { goalId: id, done: false, note: '' }] };
    });
    set({ goals, days });
    void persistMany([
      ['goals', goals],
      ['days', days],
    ]);
  },

  deleteGoal(id) {
    const state = get();
    const target = state.goals.find((g) => g.id === id);
    const goals = state.goals.filter((g) => g.id !== id);
    // Tarefa de meta excluída vira órfã: some do checklist (a meta não existe mais).
    // O histórico do dia é preservado como está — não reescrevemos o passado.
    const today = todayKey();
    const days = target
      ? state.days.map((d) =>
          d.date === today || !d.closedAt
            ? { ...d, tasks: d.tasks.filter((t) => t.goalId !== id) }
            : d,
        )
      : state.days;
    set({ goals, days });
    void persistMany([
      ['goals', goals],
      ['days', days],
    ]);
  },

  updateUser(patch) {
    const user = { ...get().user, ...patch };
    set({ user });
    void persist('user', user);
  },

  updateSettings(patch) {
    const settings = { ...get().settings, ...patch };
    set({ settings });
    void persist('settings', settings);
  },

  upsertRule(rule) {
    const state = get();
    const rules = state.rules.some((r) => r.id === rule.id)
      ? state.rules.map((r) => (r.id === rule.id ? rule : r))
      : [...state.rules, rule];
    const badges = evaluateBadges({ ...state, rules });
    set({ rules, badges });
    void persistMany([
      ['rules', rules],
      ['badges', badges],
    ]);
  },

  deleteRule(id) {
    const rules = get().rules.filter((r) => r.id !== id);
    set({ rules });
    void persist('rules', rules);
  },

  toggleRule(id) {
    const rules = get().rules.map((r) => (r.id === id ? { ...r, active: !r.active } : r));
    set({ rules });
    void persist('rules', rules);
  },

  markRuleActivated(id, success) {
    const rules = get().rules.map((r) => {
      if (r.id !== id) return r;
      const timesActivated = r.timesActivated + 1;
      const successRate = success
        ? Math.round(((r.successRate * r.timesActivated + 100) / timesActivated) * 10) / 10
        : Math.round(((r.successRate * r.timesActivated) / timesActivated) * 10) / 10;
      return { ...r, timesActivated, successRate };
    });
    set({ rules });
    void persist('rules', rules);
  },

  addReward(reward) {
    const state = get();
    const rewards = [...state.rewards, reward];
    const refreshed = evaluateRewards({ ...state, rewards });
    set({ rewards: refreshed });
    void persist('rewards', refreshed);
  },

  deleteReward(id) {
    const rewards = get().rewards.filter((r) => r.id !== id);
    set({ rewards });
    void persist('rewards', rewards);
  },

  refreshRewards() {
    const state = get();
    const rewards = evaluateRewards(state);
    if (JSON.stringify(rewards) === JSON.stringify(state.rewards)) return;
    set({ rewards });
    void persist('rewards', rewards);
  },

  addBook(book) {
    const books = [...get().books, book];
    set({ books });
    void persist('books', books);
  },

  updateBook(book) {
    const books = get().books.map((b) => (b.id === book.id ? book : b));
    set({ books });
    void persist('books', books);
  },

  deleteBook(id) {
    const books = get().books.filter((b) => b.id !== id);
    set({ books });
    void persist('books', books);
  },

  addFinance(entry) {
    const finances = [...get().finances, entry];
    set({ finances });
    void persist('finances', finances);
  },

  deleteFinance(id) {
    const finances = get().finances.filter((f) => f.id !== id);
    set({ finances });
    void persist('finances', finances);
  },

  addWeight(entry) {
    const rest = get().weight.filter((w) => w.date !== entry.date);
    const weight = [...rest, { ...entry, id: entry.id ?? newId('w') }].sort((a, b) => (a.date < b.date ? -1 : 1));
    set({ weight });
    void persist('weight', weight);
  },

  deleteWeight(date) {
    const weight = get().weight.filter((w) => w.date !== date);
    set({ weight });
    void persist('weight', weight);
  },

  setAyanokojiScore(week, scores) {
    const state = get();
    const rest = state.ayanokoji.scores.filter((s) => s.week !== week);
    const ayanokoji = {
      ...state.ayanokoji,
      startDate: state.ayanokoji.startDate || todayKey(),
      scores: [...rest, { week, ...scores }].sort((a, b) => a.week - b.week),
    };
    set({ ayanokoji });
    void persist('ayanokoji', ayanokoji);
  },

  toggleAyanokojiTask(date, taskId) {
    const state = get();
    const current = state.ayanokoji.tasksDone[date] ?? [];
    const next = current.includes(taskId) ? current.filter((t) => t !== taskId) : [...current, taskId];
    const ayanokoji = { ...state.ayanokoji, tasksDone: { ...state.ayanokoji.tasksDone, [date]: next } };
    set({ ayanokoji });
    void persist('ayanokoji', ayanokoji);
  },

  setWeeklyFocus(weekStartKey, items) {
    const weeklyFocus = { ...get().weeklyFocus, [weekStartKey]: items };
    set({ weeklyFocus });
    void persist('weeklyFocus', weeklyFocus);
  },

  setRouteAdjustment(monthKeyValue, items) {
    const routeAdjustments = { ...get().routeAdjustments, [monthKeyValue]: items };
    set({ routeAdjustments });
    void persist('routeAdjustments', routeAdjustments);
  },

  async applyImport(summary) {
    const state = get();

    // A) Backup completo do app: substitui tudo de forma atômica.
    if (summary.full) {
      // Backup pode estar incompleto/editado à mão: normaliza antes de gravar.
      const { normalizeData } = await import('./storage');
      const full = normalizeData(summary.full, { ...EMPTY_DATA, settings: state.settings });
      set({
        onboarded: true,
        user: full.user,
        goals: full.goals,
        days: full.days,
        rules: full.rules,
        rewards: full.rewards,
        books: full.books,
        finances: full.finances,
        weight: full.weight,
        settings: full.settings,
        badges: full.badges,
        ayanokoji: full.ayanokoji,
        weeklyFocus: full.weeklyFocus,
        routeAdjustments: full.routeAdjustments,
      });
      await persistMany([
        ['onboarded', true],
        ['user', full.user],
        ['goals', full.goals],
        ['days', full.days],
        ['rules', full.rules],
        ['rewards', full.rewards],
        ['books', full.books],
        ['finances', full.finances],
        ['weight', full.weight],
        ['settings', full.settings],
        ['badges', full.badges],
        ['ayanokoji', full.ayanokoji],
        ['weeklyFocus', full.weeklyFocus],
        ['routeAdjustments', full.routeAdjustments],
      ]);
      return;
    }

    // B) Plano: soma ao que existe, sem duplicar metas.
    // `relinked` são metas já existentes que ganharam originId — preserva o histórico do dia.
    const relinkedById = new Map((summary.relinked ?? []).map((g) => [g.id, g]));
    const goals = [
      ...state.goals.map((g) => relinkedById.get(g.id) ?? g),
      ...summary.goals,
    ];
    const rules = [...state.rules, ...summary.rules.filter((r) => !state.rules.some((x) => x.trigger === r.trigger && x.action === r.action))];
    const rewards = [...state.rewards, ...summary.rewards.filter((r) => !state.rewards.some((x) => x.name === r.name))];
    const books = [...state.books, ...summary.books.filter((b) => !state.books.some((x) => x.title.toLowerCase() === b.title.toLowerCase()))];
    const finances = [...state.finances, ...summary.finances];
    const weight = [...state.weight, ...summary.weight.filter((w) => !state.weight.some((x) => x.date === w.date))].sort((a, b) =>
      a.date < b.date ? -1 : 1,
    );
    const settings = { ...state.settings, ...summary.settings };
    const user: User = {
      name: summary.user.name ?? state.user.name,
      identity: summary.user.identity ?? state.user.identity,
      noMore: summary.user.noMore ?? state.user.noMore,
      areas: Array.from(new Set([...state.user.areas, ...summary.areas])),
      createdAt: state.user.createdAt || new Date().toISOString(),
    };

    set({ goals, rules, rewards, books, finances, weight, settings, user });
    await persistMany([
      ['goals', goals],
      ['rules', rules],
      ['rewards', rewards],
      ['books', books],
      ['finances', finances],
      ['weight', weight],
      ['settings', settings],
      ['user', user],
    ]);
  },

  importGoals(newGoals, areas) {
    const state = get();
    const goals = [...state.goals, ...newGoals];
    const user = { ...state.user, areas: Array.from(new Set([...state.user.areas, ...areas])) };
    set({ goals, user });
    void persistMany([
      ['goals', goals],
      ['user', user],
    ]);
  },

  async hardReset() {
    await resetAll();
    set({ ...EMPTY_DATA, status: 'ready', booted: true });
  },
}));

export { newId };

export const priorityLabel: Record<Priority, string> = {
  high: 'Prioridade',
  normal: 'Normal',
  low: 'Baixa',
};
