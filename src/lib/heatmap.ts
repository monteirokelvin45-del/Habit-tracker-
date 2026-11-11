import type { Day } from './types';
import { addDays, diffDays, todayKey, weekdayIndex, MONTHS_SHORT } from './date';

/**
 * Mural de constância (estilo GitHub contributions) — dias cumpridos.
 * Função pura: recebe os dias registrados e devolve colunas de semanas.
 *
 * Nível do dia (0-4):
 *   0 sem registro · 1 score < 4 · 2 score 4-5.9 · 3 score 6-7.9 · 4 score 8-10
 */

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  date: string;
  level: HeatLevel;
  score: number | null;
  /** Fração de tarefas concluídas no dia (0 quando não há registro). */
  ratio: number;
  done: number;
  total: number;
  isFuture: boolean;
  isToday: boolean;
  hasRecord: boolean;
}

export interface HeatWeek {
  index: number;
  cells: HeatCell[]; // sempre 7: segunda → domingo
}

export interface MoMonthLabel {
  label: string;
  column: number;
}

export interface HeatmapModel {
  weeks: HeatWeek[];
  monthLabels: MoMonthLabel[];
  /** Estatísticas do período exibido. */
  stats: {
    days: number;
    recorded: number;
    fulfilled: number; // score >= 6
    perfect: number; // score >= 8
    best: number | null;
    avg: number | null;
  };
}

export function levelFor(score: number | null): HeatLevel {
  if (score == null) return 0;
  if (score < 4) return 1;
  if (score < 6) return 2;
  if (score < 8) return 3;
  return 4;
}

function cellFor(day: Day | undefined, date: string, today: string): HeatCell {
  const total = day?.tasks.length ?? 0;
  const done = day?.tasks.filter((t) => t.done).length ?? 0;
  const score = day?.score?.total ?? null;
  return {
    date,
    level: levelFor(score),
    score,
    ratio: total > 0 ? done / total : 0,
    done,
    total,
    isFuture: date > today,
    isToday: date === today,
    hasRecord: !!day && (!!day.score || total > 0),
  };
}

/** Segunda-feira da semana da data. */
function mondayOf(date: string): string {
  const idx = weekdayIndex(date); // 0 = domingo
  const offset = idx === 0 ? -6 : 1 - idx;
  return addDays(date, offset);
}

export function buildHeatmap(days: Day[], opts?: { weeks?: number; end?: string }): HeatmapModel {
  const weeksCount = Math.max(1, Math.min(60, opts?.weeks ?? 53));
  const today = todayKey();
  const end = opts?.end ?? today;

  const byDate = new Map(days.map((d) => [d.date, d]));
  const lastMonday = mondayOf(end);
  const firstMonday = addDays(lastMonday, -7 * (weeksCount - 1));

  const weeks: HeatWeek[] = [];
  const monthLabels: MoMonthLabel[] = [];
  let previousMonth = -1;

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = addDays(firstMonday, w * 7);
    const cells: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      cells.push(cellFor(byDate.get(date), date, today));
    }
    weeks.push({ index: w, cells });

    const month = Number(weekStart.slice(5, 7));
    if (month !== previousMonth) {
      monthLabels.push({ label: MONTHS_SHORT[month - 1] ?? '', column: w });
      previousMonth = month;
    }
  }

  const flat = weeks.flatMap((week) => week.cells).filter((c) => !c.isFuture && c.hasRecord);
  const scores = flat.map((c) => c.score).filter((s): s is number => s != null);

  return {
    weeks,
    monthLabels,
    stats: {
      days: weeksCount * 7,
      recorded: flat.length,
      fulfilled: scores.filter((s) => s >= 6).length,
      perfect: scores.filter((s) => s >= 8).length,
      best: scores.length ? Math.max(...scores) : null,
      avg: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    },
  };
}

/** Mural de um mês específico (grade 7 × N, começando na segunda). */
export function buildMonthGrid(days: Day[], year: number, month: number): HeatWeek[] {
  const start = mondayOf(`${year}-${String(month + 1).padStart(2, '0')}-01`);
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const byDate = new Map(days.map((d) => [d.date, d]));
  const today = todayKey();

  // Da segunda antes do dia 1 até a semana que contém o último dia do mês.
  const lastOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const lastWeekStart = mondayOf(lastOfMonth);
  const weekCount = Math.round(diffDays(lastWeekStart, start) / 7) + 1;

  const weeks: HeatWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(start, w * 7);
    const cells: HeatCell[] = [];
    let inMonth = false;
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d);
      const belongs = date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`);
      if (belongs) inMonth = true;
      cells.push(
        belongs
          ? cellFor(byDate.get(date), date, today)
          : { ...cellFor(undefined, date, today), hasRecord: false, level: 0 },
      );
    }
    if (inMonth) weeks.push({ index: w, cells });
  }
  return weeks;
}

export const HEAT_LEGEND: { level: HeatLevel; label: string }[] = [
  { level: 0, label: 'Sem registro' },
  { level: 1, label: 'Abaixo de 4' },
  { level: 2, label: '4 a 5,9' },
  { level: 3, label: '6 a 7,9' },
  { level: 4, label: '8 a 10' },
];
