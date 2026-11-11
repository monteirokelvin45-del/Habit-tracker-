import type { AppData, Book, FinanceEntry, Goal, Reward, Rule, WeightEntry } from './types';

/**
 * Sanitização de dados que vêm de fora (storage antigo, backup editado, gravação
 * interrompida). Fica num módulo próprio porque `normalizeData` já estava grande
 * e porque cada entidade tem a sua regra.
 *
 * Regra de ouro: **reparar quando dá, descartar quando não dá — nunca inventar**.
 * - `amount: "50"` (string) → 50: recuperável, o número está lá.
 * - `amount: null` / `NaN` / negativo em despesa → descarta: não há valor para
 *   recuperar, e manter a linha derrubava a tela de Finanças
 *   (`undefined is not a function` em `.toFixed`).
 *
 * Isso importa porque `JSON.stringify(NaN)` grava `null`: qualquer tela que
 * salve `Number(texto) || NaN` no storage vira um registro quebrado no próximo boot.
 */

export interface SanitizeReport {
  /** Linhas que não puderam ser reparadas e foram descartadas, por entidade. */
  dropped: Record<string, number>;
  /** Total descartado (atalho para a UI). */
  total: number;
}

export function emptyReport(): SanitizeReport {
  return { dropped: {}, total: 0 };
}

function count(report: SanitizeReport | undefined, entity: string): void {
  if (!report) return;
  report.dropped[entity] = (report.dropped[entity] ?? 0) + 1;
  report.total += 1;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Número finito a partir de number | string numérica. `null` se não der. */
export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    // Aceita "50", "50,25", " R$ 50 ". Recusa "" e texto.
    const clean = value.trim().replace(/[^\d,.-]/g, '').replace(',', '.');
    if (!clean) return null;
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function sanitizeFinanceEntry(raw: unknown, report?: SanitizeReport): FinanceEntry | null {
  if (!raw || typeof raw !== 'object') {
    count(report, 'finances');
    return null;
  }
  const e = raw as Partial<FinanceEntry>;
  const date = typeof e.date === 'string' && DATE_RE.test(e.date) ? e.date : null;
  const amount = toFiniteNumber(e.amount);
  const type = e.type === 'income' || e.type === 'expense' ? e.type : null;
  // Valor 0 não é lançamento (a tela exige > 0) e negativo em qualquer tipo é erro de sinal.
  if (!date || amount == null || amount <= 0 || !type) {
    count(report, 'finances');
    return null;
  }
  return {
    ...e,
    id: typeof e.id === 'string' && e.id ? e.id : `fin-legado-${date}-${Math.round(amount * 100)}`,
    date,
    amount: Math.round(amount * 100) / 100,
    type,
    category: typeof e.category === 'string' && e.category ? e.category : 'Outros',
    isImpulse: !!e.isImpulse,
    note: typeof e.note === 'string' ? e.note : '',
  } as FinanceEntry;
}

export function sanitizeFinanceList(raw: unknown, report?: SanitizeReport): FinanceEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => sanitizeFinanceEntry(x, report)).filter((x): x is FinanceEntry => x != null);
}

export function sanitizeWeightEntry(raw: unknown, report?: SanitizeReport): WeightEntry | null {
  if (!raw || typeof raw !== 'object') {
    count(report, 'weight');
    return null;
  }
  const w = raw as Partial<WeightEntry>;
  const date = typeof w.date === 'string' && DATE_RE.test(w.date) ? w.date : null;
  const kg = toFiniteNumber(w.kg);
  // Peso plausível: 20–400 kg. Fora disso é digitação errada (0, 999) e não medida.
  if (!date || kg == null || kg < 20 || kg > 400) {
    count(report, 'weight');
    return null;
  }
  const measurements =
    w.measurements && typeof w.measurements === 'object'
      ? Object.fromEntries(
          Object.entries(w.measurements)
            .map(([k, v]) => [k, toFiniteNumber(v)])
            .filter(([, v]) => v != null),
        )
      : undefined;
  return {
    ...w,
    id: typeof w.id === 'string' && w.id ? w.id : `w-${date}`,
    date,
    kg: Math.round(kg * 10) / 10,
    ...(measurements && Object.keys(measurements).length ? { measurements } : {}),
  } as WeightEntry;
}

export function sanitizeWeightList(raw: unknown, report?: SanitizeReport): WeightEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: WeightEntry[] = [];
  for (const item of raw) {
    const entry = sanitizeWeightEntry(item, report);
    if (!entry) continue;
    // Um registro por dia (a tela sobrescreve por data); duplicata mantém o último.
    if (seen.has(entry.date)) {
      const idx = out.findIndex((x) => x.date === entry.date);
      if (idx >= 0) out[idx] = entry;
      continue;
    }
    seen.add(entry.date);
    out.push(entry);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function sanitizeBook(raw: unknown, report?: SanitizeReport): Book | null {
  if (!raw || typeof raw !== 'object') {
    count(report, 'books');
    return null;
  }
  const b = raw as Partial<Book>;
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (!title) {
    count(report, 'books');
    return null;
  }
  const totalPages = Math.max(0, Math.round(toFiniteNumber(b.totalPages) ?? 0));
  const currentPage = Math.min(totalPages, Math.max(0, Math.round(toFiniteNumber(b.currentPage) ?? 0)));
  const dailyGoal = b.dailyGoal && typeof b.dailyGoal === 'object'
    ? {
        min: Math.max(0, Math.round(toFiniteNumber(b.dailyGoal.min) ?? 5)),
        ideal: Math.max(0, Math.round(toFiniteNumber(b.dailyGoal.ideal) ?? 20)),
        excellent: Math.max(0, Math.round(toFiniteNumber(b.dailyGoal.excellent) ?? 40)),
      }
    : { min: 5, ideal: 20, excellent: 40 };
  const log = Array.isArray(b.log)
    ? b.log
        .filter((l): l is NonNullable<typeof l> => !!l && typeof l === 'object')
        .map((l) => ({ date: String(l.date ?? ''), pages: Math.max(0, Math.round(toFiniteNumber(l.pages) ?? 0)) }))
        .filter((l) => DATE_RE.test(l.date))
    : [];
  return {
    ...b,
    id: typeof b.id === 'string' && b.id ? b.id : `book-${title.toLowerCase().slice(0, 20)}`,
    title,
    author: typeof b.author === 'string' ? b.author : '',
    totalPages,
    currentPage,
    dailyGoal,
    log,
    finished: !!b.finished || (totalPages > 0 && currentPage >= totalPages),
  } as Book;
}

export function sanitizeBookList(raw: unknown, report?: SanitizeReport): Book[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => sanitizeBook(x, report)).filter((x): x is Book => x != null);
}

export function sanitizeRule(raw: unknown, report?: SanitizeReport): Rule | null {
  if (!raw || typeof raw !== 'object') {
    count(report, 'rules');
    return null;
  }
  const r = raw as Partial<Rule>;
  const trigger = typeof r.trigger === 'string' ? r.trigger.trim() : '';
  const action = typeof r.action === 'string' ? r.action.trim() : '';
  // Regra sem gatilho ou sem ação não é regra: não há o que executar.
  if (!trigger || !action) {
    count(report, 'rules');
    return null;
  }
  return {
    ...r,
    id: typeof r.id === 'string' && r.id ? r.id : `rule-${trigger.slice(0, 12)}-${action.slice(0, 12)}`,
    trigger,
    action,
    reason: typeof r.reason === 'string' ? r.reason : '',
    active: r.active !== false,
    timesActivated: Math.max(0, Math.round(toFiniteNumber(r.timesActivated) ?? 0)),
    successRate: Math.min(1, Math.max(0, toFiniteNumber(r.successRate) ?? 0)),
    createdAt: typeof r.createdAt === 'string' && r.createdAt ? r.createdAt : new Date().toISOString(),
  } as Rule;
}

export function sanitizeRuleList(raw: unknown, report?: SanitizeReport): Rule[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => sanitizeRule(x, report)).filter((x): x is Rule => x != null);
}

export function sanitizeReward(raw: unknown, report?: SanitizeReport): Reward | null {
  if (!raw || typeof raw !== 'object') {
    count(report, 'rewards');
    return null;
  }
  const r = raw as Partial<Reward>;
  const name = typeof r.name === 'string' ? r.name.trim() : '';
  if (!name) {
    count(report, 'rewards');
    return null;
  }
  const criteriaType = r.criteriaType === 'streak' || r.criteriaType === 'score' || r.criteriaType === 'consistency'
    ? r.criteriaType
    : 'consistency';
  return {
    ...r,
    id: typeof r.id === 'string' && r.id ? r.id : `reward-${name.toLowerCase().slice(0, 20)}`,
    name,
    criteria: typeof r.criteria === 'string' ? r.criteria : '',
    criteriaType,
    target: Math.max(1, Math.round(toFiniteNumber(r.target) ?? 7)),
    current: Math.max(0, toFiniteNumber(r.current) ?? 0),
    unlocked: !!r.unlocked,
    ...(typeof r.unlockedAt === 'string' && r.unlockedAt ? { unlockedAt: r.unlockedAt } : {}),
  } as Reward;
}

export function sanitizeRewardList(raw: unknown, report?: SanitizeReport): Reward[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => sanitizeReward(x, report)).filter((x): x is Reward => x != null);
}

/** Metas: delega para `sanitizeGoal` (que já existia) e descarta id vazio. */
export function sanitizeGoalList(raw: unknown, sanitizeGoal: (g: Partial<Goal>) => Goal, report?: SanitizeReport): Goal[] {
  if (!Array.isArray(raw)) return [];
  const out: Goal[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') {
      count(report, 'goals');
      continue;
    }
    const g = item as Partial<Goal>;
    if (typeof g.id !== 'string' || !g.id) {
      count(report, 'goals');
      continue;
    }
    out.push(sanitizeGoal(g));
  }
  return out;
}

/**
 * Aplica todos os sanitizadores a um `AppData` (parcial) e devolve o relatório.
 * Usado no `loadAll` (boot) e no import de backup.
 */
export function sanitizeDataSlices(raw: {
  goals?: unknown;
  finances?: unknown;
  weight?: unknown;
  books?: unknown;
  rules?: unknown;
  rewards?: unknown;
}, sanitizeGoalFn: (g: Partial<Goal>) => Goal, report: SanitizeReport = emptyReport()): Pick<AppData, 'goals' | 'finances' | 'weight' | 'books' | 'rules' | 'rewards'> {
  return {
    goals: sanitizeGoalList(raw.goals, sanitizeGoalFn, report),
    finances: sanitizeFinanceList(raw.finances, report),
    weight: sanitizeWeightList(raw.weight, report),
    books: sanitizeBookList(raw.books, report),
    rules: sanitizeRuleList(raw.rules, report),
    rewards: sanitizeRewardList(raw.rewards, report),
  };
}
