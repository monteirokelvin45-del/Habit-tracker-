import type { AppData, BadgeState, Day } from './types';
import { addDays, lastNDays, todayKey } from './date';

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  criteria: string;
  check: (data: AppData) => boolean;
}

const closedDays = (days: Day[]): Day[] => days.filter((d) => !!d.score).sort((a, b) => (a.date < b.date ? -1 : 1));

function longestStreakAbove(days: Day[], threshold: number): number {
  const closed = closedDays(days);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of closed) {
    const ok = (d.score?.total ?? 0) > threshold;
    if (ok && prev && addDays(prev, 1) === d.date) run += 1;
    else if (ok) run = 1;
    else run = 0;
    best = Math.max(best, run);
    prev = ok ? d.date : null;
  }
  return best;
}

function consecutiveRecordDays(days: Day[]): number {
  const closed = closedDays(days);
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of closed) {
    if (prev && addDays(prev, 1) === d.date) run += 1;
    else run = 1;
    best = Math.max(best, run);
    prev = d.date;
  }
  return best;
}

function perfectWeek(days: Day[]): boolean {
  const closed = closedDays(days);
  if (closed.length < 7) return false;
  const last7 = closed.slice(-7);
  if (last7.length < 7) return false;
  if (addDays(last7[0]!.date, 6) !== last7[6]!.date) return false;
  return last7.every((d) => (d.score?.total ?? 0) > 8);
}

function recoveryFast(days: Day[]): boolean {
  const closed = closedDays(days);
  for (let i = 0; i + 2 < closed.length; i++) {
    const a = closed[i]!.score?.total ?? 10;
    const b = closed[i + 1]!.score?.total ?? 10;
    const c = closed[i + 2]!.score?.total ?? 0;
    if (a < 5 && b < 5 && c >= 7) return true;
  }
  return false;
}

function honestyTotal(data: AppData): boolean {
  const days = lastNDays(7);
  const closed = closedDays(data.days).filter((d) => days.includes(d.date));
  if (closed.length < 7) return false;
  return closed.every(
    (d) =>
      d.diary.context.where.trim().length > 0 &&
      (d.diary.context.trigger.trim().length > 0 || d.diary.context.distraction.trim().length > 0),
  );
}

function areaStreak(data: AppData, areaName: string, target: number): boolean {
  const goals = data.goals.filter((g) => g.area === areaName && g.active);
  if (!goals.length) return false;
  const ids = new Set(goals.map((g) => g.id));
  let streak = 0;
  let cursor = todayKey();
  const map = new Map(data.days.map((d) => [d.date, d]));
  for (let i = 0; i < 400; i++) {
    const day = map.get(cursor);
    const tasks = day?.tasks.filter((t) => ids.has(t.goalId)) ?? [];
    if (!tasks.length) {
      if (i === 0) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    if (tasks.some((t) => t.done)) streak += 1;
    else break;
    if (streak >= target) return true;
    cursor = addDays(cursor, -1);
  }
  return false;
}

export const BADGES: BadgeDef[] = [
  {
    id: 'first-week',
    emoji: '🏅',
    name: 'Primeira Semana',
    criteria: '7 dias de registro',
    check: (d) => consecutiveRecordDays(d.days) >= 7,
  },
  {
    id: 'on-fire',
    emoji: '🔥',
    name: 'Em Chamas',
    criteria: 'Streak de 14 dias com score > 5',
    check: (d) => longestStreakAbove(d.days, 5) >= 14,
  },
  {
    id: 'perfect-week',
    emoji: '💎',
    name: 'Semana Perfeita',
    criteria: 'Score > 8 em 7 dias seguidos',
    check: (d) => perfectWeek(d.days),
  },
  {
    id: 'fast-recovery',
    emoji: '🔄',
    name: 'Recuperação Rápida',
    criteria: 'Voltou ao eixo (score ≥ 7) após 2+ dias de falha',
    check: (d) => recoveryFast(d.days),
  },
  {
    id: 'total-honesty',
    emoji: '🎯',
    name: 'Honestidade Total',
    criteria: 'Contexto preenchido 7 dias seguidos',
    check: honestyTotal,
  },
  {
    id: 'reader',
    emoji: '📚',
    name: 'Leitor',
    criteria: '30 dias de leitura registrada',
    check: (d) => areaStreak(d, 'Leitura', 30) || d.books.some((b) => (b.log?.length ?? 0) >= 30),
  },
  {
    id: 'unbreakable',
    emoji: '💪',
    name: 'Inabalável',
    criteria: '30 dias de treino',
    check: (d) => areaStreak(d, 'Treino', 30),
  },
  {
    id: 'strategist',
    emoji: '🧠',
    name: 'Estrategista',
    criteria: 'Criou 5 regras SE-ENTÃO',
    check: (d) => d.rules.length >= 5,
  },
];

export function badgeState(data: AppData): BadgeState[] {
  return BADGES.map((b) => {
    const existing = data.badges.find((s) => s.id === b.id);
    if (existing?.unlockedAt) return existing;
    return b.check(data) ? { id: b.id, unlockedAt: new Date().toISOString() } : { id: b.id, unlockedAt: null };
  });
}

export function evaluateBadges(data: AppData): BadgeState[] {
  return badgeState(data);
}
