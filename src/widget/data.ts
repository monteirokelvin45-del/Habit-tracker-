import type { AppData, Day, DayMode, Goal } from '../lib/types';
import { addDays, nowHHmm, todayKey } from '../lib/date';
import { buildChecklist, generalStreak } from '../lib/score';

/**
 * Dados do widget — função PURA sobre AppData.
 * Regra do produto: o widget nunca inventa informação. Sem dado => "Sem dado".
 */

export const WIDGET_NAME = 'Prime';

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

export type { Day, Goal };
