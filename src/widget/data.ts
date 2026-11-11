import type { AppData, Day, DayMode, Goal } from '../lib/types';
import { levelFor } from '../lib/heatmap';
import { addDays as addDaysKey, keyToDate, nowHHmm, todayKey } from '../lib/date';
import { buildChecklist, generalStreak } from '../lib/score';

/**
 * Dados do widget — função PURA sobre AppData.
 * Regra do produto: o widget nunca inventa informação. Sem dado => "Sem dado".
 */

export const WIDGET_NAME = 'Prime';
export const CONSTANCY_WIDGET_NAME = 'Constancia';

export interface WidgetTask {
  label: string;
  area: string;
  priority: string;
  target: string;
}

export interface WidgetData {
  streak: number;
  mode: DayMode;
  modeLabel: string;
  modeEmoji: string;
  modeColor: `#${string}`;
  done: number;
  total: number;
  ratio: number;
  nextTask: WidgetTask | null;
  allDone: boolean;
  hasGoals: boolean;
  hint: string;
}

const MODE_META: Record<DayMode, { label: string; emoji: string; color: `#${string}` }> = {
  normal: { label: 'Normal', emoji: '🟢', color: '#00FF88' },
  minimal: { label: 'Mínimo', emoji: '🟡', color: '#FFAA00' },
  attack: { label: 'Ataque', emoji: '🟣', color: '#AA66FF' },
  recovery: { label: 'Recuperação', emoji: '🔴', color: '#FF6B35' },
};

export function modeMeta(mode: DayMode) {
  return MODE_META[mode] ?? MODE_META.normal;
}

export function widgetData(data: AppData, date = todayKey()): WidgetData {
  const day: Day | undefined = data.days.find((d) => d.date === date);
  const mode: DayMode = day?.mode ?? 'normal';
  const meta = modeMeta(mode);
  const activeGoals = data.goals.filter((g) => g.active && !g.archived);
  const checklist = buildChecklist(data.goals, mode);

  const tasks = day?.tasks ?? [];
  const done = tasks.filter((t) => t.done).length;
  const total = Math.max(checklist.length, tasks.length);

  const nextItem = checklist.find((item) => {
    const key = item.extraKey ?? item.goal.id;
    return !tasks.find((t) => t.goalId === key)?.done;
  });

  const priorityLabel: Record<Goal['priority'], string> = {
    high: '🔴',
    normal: '🟡',
    low: '⚪',
  };

  const allDone = checklist.length > 0 && checklist.every((i) => tasks.find((t) => t.goalId === (i.extraKey ?? i.goal.id))?.done);

  return {
    streak: generalStreak(data.days, addDaysSafe(date)),
    mode,
    modeLabel: meta.label,
    modeEmoji: meta.emoji,
    modeColor: meta.color,
    done,
    total,
    ratio: total > 0 ? done / total : 0,
    nextTask: nextItem
      ? {
          label: nextItem.goal.name,
          area: nextItem.goal.area,
          priority: priorityLabel[nextItem.goal.priority] ?? '🟡',
          target: nextItem.target,
        }
      : null,
    allDone,
    hasGoals: activeGoals.length > 0,
    hint: !activeGoals.length
      ? 'Crie uma meta para começar'
      : allDone
        ? 'Checklist completo ✅'
        : day?.closedAt
          ? 'Dia encerrado'
          : 'Toque para abrir o loop',
  };
}

function addDaysSafe(date: string): string {
  // generalStreak conta a partir do dia atual; usamos o próprio dia do widget.
  return date || todayKey();
}

/**
 * Conclui a próxima tarefa direto do widget (click action).
 * Mantém a integridade: só marca como feita e registra o horário; nada é inventado.
 */
export function completeNextTask(data: AppData, date = todayKey()): { data: AppData; completed: string | null; skipped: boolean } {
  const day = data.days.find((d) => d.date === date);
  if (!day) return { data, completed: null, skipped: true };
  if (day.closedAt) return { data, completed: null, skipped: true };

  const checklist = buildChecklist(data.goals, day.mode);
  const next = checklist.find((item) => {
    const key = item.extraKey ?? item.goal.id;
    return !day.tasks.find((t) => t.goalId === key)?.done;
  });
  if (!next) return { data, completed: null, skipped: true };

  const key = next.extraKey ?? next.goal.id;
  const exists = day.tasks.some((t) => t.goalId === key);
  const tasks = exists
    ? day.tasks.map((t) => (t.goalId === key ? { ...t, done: true, doneAt: nowHHmm(), failAt: undefined } : t))
    : [...day.tasks, { goalId: key, done: true, note: '', doneAt: nowHHmm() }];

  const updated: Day = { ...day, tasks };
  const days = data.days.map((d) => (d.date === date ? updated : d));
  return { data: { ...data, days }, completed: next.goal.name, skipped: false };
}

/* ────────────────── widget do mural de constância ────────────────── */

export interface MuralCell {
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
  color: `#${string}`;
  isToday: boolean;
  isFuture: boolean;
}

export interface MuralColumn {
  /** Índice da semana (0 = mais antiga). */
  index: number;
  cells: MuralCell[];
}

export const MURAL_COLORS: Record<0 | 1 | 2 | 3 | 4, `#${string}`> = {
  0: '#1F1F1F',
  1: '#B32B2B',
  2: '#A87300',
  3: '#00A85A',
  4: '#39FF14',
};

/**
 * Quantas semanas cabem na largura informada (dp) do widget.
 * Sem tabelas mágicas: célula + gap medidos, descontando o rótulo dos dias.
 */
export function muralColumnsForWidth(width: number, cell = 9, gap = 2, labelWidth = 16, padding = 12): number {
  // Desconta rótulo + padding horizontal do card (12dp de cada lado por padrão).
  const usable = Math.max(cell, width - labelWidth - padding * 2);
  const weeks = Math.floor(usable / (cell + gap));
  return Math.max(6, Math.min(53, weeks));
}

/**
 * Prepara as colunas do mural para o widget.
 * Função pura sobre AppData — o widget nunca inventa dia: sem registro, nível 0.
 */
export function muralData(data: AppData, opts?: { width?: number; cell?: number; gap?: number; labelWidth?: number; end?: string }) {
  const cell = opts?.cell ?? 9;
  const gap = opts?.gap ?? 2;
  // Limite de segurança: RemoteViews não gosta de centenas de views no mesmo widget.
  const weeks = Math.min(26, muralColumnsForWidth(opts?.width ?? 300, cell, gap, opts?.labelWidth ?? 16));
  const today = opts?.end ?? todayKey();
  // Handler do widget roda fora do app: nenhuma chave pode faltar (dado antigo/parcial).
  const byDate = new Map((data.days ?? []).map((d) => [d.date, d]));

  // segunda-feira da semana atual
  const dow = keyToDate(today).getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const thisMonday = addDaysKey(today, mondayOffset);

  const columns: MuralColumn[] = [];
  let fulfilled = 0;
  let recorded = 0;

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = addDaysKey(thisMonday, -7 * w);
    const cells: MuralCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDaysKey(weekStart, d);
      const day = byDate.get(date);
      const score = day?.score?.total ?? null;
      const level = levelFor(score);
      if (date <= today && (score != null || (day?.tasks?.length ?? 0) > 0)) {
        recorded += 1;
        if ((score ?? 0) >= 6) fulfilled += 1;
      }
      cells.push({
        date,
        level,
        color: MURAL_COLORS[level],
        isToday: date === today,
        isFuture: date > today,
      });
    }
    columns.push({ index: weeks - 1 - w, cells });
  }

  const streak = generalStreak(data.days ?? [], today);
  const monthOf = (date: string) => Number(date.slice(5, 7));
  const monthLabels: { label: string; column: number }[] = [];
  let lastMonth = -1;
  columns.forEach((col) => {
    const month = monthOf(col.cells[0]!.date);
    if (month !== lastMonth) {
      monthLabels.push({ label: MONTHS_ABBR[month - 1] ?? '', column: col.index });
      lastMonth = month;
    }
  });

  return { columns, weeks, fulfilled, recorded, streak, today, monthLabels };
}

const MONTHS_ABBR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export type { Day, Goal };
