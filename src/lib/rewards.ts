import type { AppData, Reward } from './types';
import { addDays } from './date';
import { generalStreak } from './score';

function currentFor(reward: Reward, data: AppData): number {
  const closed = data.days.filter((d) => !!d.score).sort((a, b) => (a.date < b.date ? -1 : 1));

  if (reward.criteriaType === 'streak') {
    return Math.min(reward.target, generalStreak(data.days));
  }

  if (reward.criteriaType === 'score') {
    // `target` = quantidade de dias seguidos. O piso de score é a meta diária do usuário
    // (settings.targetDailyScore). Antes o mesmo número era usado para as duas coisas:
    // uma recompensa de 30 dias exigia score ≥ 30 — impossível, pois o score vai até 10.
    const floor = data.settings.targetDailyScore ?? 7;
    const map = new Map(closed.map((d) => [d.date, d]));
    let cursor = closed.length ? closed[closed.length - 1]!.date : null;
    let run = 0;
    while (cursor && run < reward.target) {
      const day = map.get(cursor);
      if (!day?.score || day.score.total < floor) break;
      run += 1;
      cursor = addDays(cursor, -1);
    }
    return run;
  }

  // consistency: % de tarefas feitas nos últimos `target` dias.
  const recent = closed.slice(-Math.max(1, reward.target));
  if (!recent.length) return 0;
  const total = recent.reduce((acc, d) => acc + d.tasks.length, 0);
  const done = recent.reduce((acc, d) => acc + d.tasks.filter((t) => t.done).length, 0);
  return total ? Math.round((done / total) * 100) : 0;
}

export function evaluateRewards(data: AppData): Reward[] {
  return data.rewards.map((r) => {
    const current = currentFor(r, data);
    const unlocked = r.unlocked || current >= r.target;
    return {
      ...r,
      current,
      unlocked,
      unlockedAt: unlocked ? r.unlockedAt ?? new Date().toISOString() : undefined,
    };
  });
}

export function daysToUnlock(reward: Reward): number | null {
  if (reward.unlocked) return null;
  const remaining = reward.target - reward.current;
  return remaining > 0 ? remaining : 0;
}

export function rewardProgress(reward: Reward): number {
  if (reward.target <= 0) return 1;
  return Math.max(0, Math.min(1, reward.current / reward.target));
}
