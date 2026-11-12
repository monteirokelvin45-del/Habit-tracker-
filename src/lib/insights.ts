import type { AppData, Day, Goal } from './types';
import { addDays, lastNDays, todayKey, weekdayIndex } from './date';
import { avg, round1 } from './score';

/** Regra 4: nunca forçar padrão com menos de 7 dias de dados. */
export const MIN_DAYS_FOR_PATTERNS = 7;

export function closedDays(days: Day[]): Day[] {
  return days.filter((d) => !!d.score).sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function percent(n: number, total: number): number {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

export interface PatternResult<T> {
  ready: boolean;
  daysCollected: number;
  value: T | null;
  label: string;
}

function guard<T>(data: AppData, compute: () => T | null): PatternResult<T> {
  const closed = closedDays(data.days);
  const ready = closed.length >= MIN_DAYS_FOR_PATTERNS;
  return {
    ready,
    daysCollected: closed.length,
    value: ready ? compute() : null,
    label: ready ? '' : `Coletando dados... (${Math.min(closed.length, MIN_DAYS_FOR_PATTERNS)}/${MIN_DAYS_FOR_PATTERNS} dias)`,
  };
}

/** Horário de falha mais comum (timestamps de tarefas não feitas). */
export function failureHour(data: AppData) {
  return guard(data, () => {
    const buckets = new Map<string, number>();
    for (const d of closedDays(data.days)) {
      for (const t of d.tasks) {
        if (t.done || !t.failAt) continue;
        const hour = parseInt(t.failAt.slice(0, 2), 10);
        const key = `${String(hour).padStart(2, '0')}h-${String(hour + 2).padStart(2, '0')}h`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
    const failures = Array.from(buckets.values()).reduce((a, b) => a + b, 0);
    const top = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return {
      bucket: top[0],
      count: top[1],
      pct: percent(top[1], failures),
    };
  });
}

/** Melhor horário produtivo. */
export function bestHour(data: AppData) {
  return guard(data, () => {
    const buckets = new Map<string, number>();
    for (const d of closedDays(data.days)) {
      for (const t of d.tasks) {
        if (!t.done || !t.doneAt) continue;
        const hour = parseInt(t.doneAt.slice(0, 2), 10);
        const key = `${String(hour).padStart(2, '0')}h-${String(hour + 2).padStart(2, '0')}h`;
        buckets.set(key, (buckets.get(key) ?? 0) + 1);
      }
    }
    const top = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return { bucket: top[0], count: top[1] };
  });
}

/** Desculpa mais usada (tipo + legitimidade). */
export function topExcuse(data: AppData) {
  return guard(data, () => {
    const types = new Map<string, number>();
    const legit = new Map<string, number>();
    let total = 0;
    for (const d of closedDays(data.days)) {
      for (const t of d.tasks) {
        if (!t.excuse?.type) continue;
        total += 1;
        types.set(t.excuse.type, (types.get(t.excuse.type) ?? 0) + 1);
        if (t.excuse.legitimacy) legit.set(t.excuse.legitimacy, (legit.get(t.excuse.legitimacy) ?? 0) + 1);
      }
    }
    const topType = Array.from(types.entries()).sort((a, b) => b[1] - a[1])[0];
    const topLegit = Array.from(legit.entries()).sort((a, b) => b[1] - a[1])[0];
    if (!topType) return null;
    return {
      type: topType[0],
      legitimacy: topLegit?.[0] ?? '—',
      count: topType[1],
      pct: percent(topType[1], total),
    };
  });
}

/** Ranking de desculpas (top N) por tipo e legitimidade. */
export function excuseRanking(data: AppData, limit = 3) {
  const counts = new Map<string, { type: string; legitimacy: string; count: number }>();
  let total = 0;
  for (const d of closedDays(data.days)) {
    for (const t of d.tasks) {
      if (!t.excuse?.type) continue;
      total += 1;
      const key = `${t.excuse.type}/${t.excuse.legitimacy}`;
      const item = counts.get(key) ?? { type: t.excuse.type, legitimacy: t.excuse.legitimacy, count: 0 };
      item.count += 1;
      counts.set(key, item);
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((i) => ({ ...i, pct: percent(i.count, total) }));
}

/** Áreas que caem juntas (correlação simples). */
/**
 * Áreas que falham juntas.
 *
 * Exige amostra: o card afirmava "quando Treino falha, Leitura falha 100% das
 * vezes" com 2 dias de base — 100% de 2 não é padrão, é coincidência. Agora a
 * função só devolve resultado com `MIN_SAMPLES_FOR_CORRELATION` dias em que a
 * primeira área falhou, e a tela mostra o `n` junto da frase.
 */
export const MIN_SAMPLES_FOR_CORRELATION = 4;

export function areaCorrelation(data: AppData) {
  return guard(data, () => {
    const closed = closedDays(data.days);
    const areas = Array.from(new Set(data.goals.map((g) => g.area)));
    const results: { a: string; b: string; pct: number; samples: number }[] = [];

    const failedOn = (day: Day, area: string): boolean | null => {
      const ids = new Set(data.goals.filter((g) => g.area === area).map((g) => g.id));
      const tasks = day.tasks.filter((t) => ids.has(t.goalId));
      if (!tasks.length) return null;
      return tasks.some((t) => !t.done);
    };

    for (let i = 0; i < areas.length; i++) {
      for (let j = 0; j < areas.length; j++) {
        if (i === j) continue;
        const a = areas[i]!;
        const b = areas[j]!;
        let aFail = 0;
        let bothFail = 0;
        for (const day of closed) {
          const fa = failedOn(day, a);
          const fb = failedOn(day, b);
          if (fa === null || fb === null) continue;
          if (fa) aFail += 1;
          if (fa && fb) bothFail += 1;
        }
        if (aFail >= MIN_SAMPLES_FOR_CORRELATION) results.push({ a, b, pct: percent(bothFail, aFail), samples: aFail });
      }
    }
    return results.sort((x, y) => y.pct - x.pct)[0] ?? null;
  });
}

/** Mapa de gatilhos (campo contexto do diário + texto de distração). */
export function triggerMap(data: AppData, limit = 6) {
  const counts = new Map<string, number>();
  for (const d of closedDays(data.days)) {
    const candidates = [d.diary.context.trigger, d.diary.context.distraction, d.diary.temptation];
    for (const raw of candidates) {
      const value = raw?.trim();
      if (!value) continue;
      const key = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Padrões de falha recorrentes (sequências de áreas). */
export function failureMap(data: AppData) {
  const closed = closedDays(data.days);
  const sequences = new Map<string, number>();
  for (const day of closed) {
    const failedAreas: string[] = [];
    for (const area of Array.from(new Set(data.goals.map((g) => g.area)))) {
      const ids = new Set(data.goals.filter((g) => g.area === area).map((g) => g.id));
      const tasks = day.tasks.filter((t) => ids.has(t.goalId));
      if (tasks.length && tasks.every((t) => !t.done)) failedAreas.push(area);
    }
    if (failedAreas.length >= 2) {
      const key = failedAreas.join(' → ');
      sequences.set(key, (sequences.get(key) ?? 0) + 1);
    }
  }

  // Comparação fim de semana vs semana.
  const weekend = closed.filter((d) => [0, 6].includes(weekdayIndex(d.date)));
  const weekdays = closed.filter((d) => ![0, 6].includes(weekdayIndex(d.date)));
  const wAvg = avg(weekend.map((d) => d.score?.total ?? 0));
  const dAvg = avg(weekdays.map((d) => d.score?.total ?? 0));
  const weekendDrop =
    wAvg != null && dAvg != null && dAvg > 0 ? Math.round(((dAvg - wAvg) / dAvg) * 100) : null;

  return {
    ready: closed.length >= MIN_DAYS_FOR_PATTERNS,
    sequences: Array.from(sequences.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    weekendDrop,
    weekendAvg: wAvg != null ? round1(wAvg) : null,
    weekdayAvg: dAvg != null ? round1(dAvg) : null,
  };
}

/** Correlação sono x performance. */
export function sleepCorrelation(data: AppData) {
  const closed = closedDays(data.days).filter((d) => d.diary.sleep.hours > 0);
  const low = closed.filter((d) => d.diary.sleep.hours < 6);
  const ok = closed.filter((d) => d.diary.sleep.hours >= 6);
  if (closed.length < MIN_DAYS_FOR_PATTERNS || low.length < 2 || ok.length < 2) return null;
  const lowAvg = avg(low.map((d) => d.score?.total ?? 0));
  const okAvg = avg(ok.map((d) => d.score?.total ?? 0));
  if (lowAvg == null || okAvg == null) return null;
  return {
    diff: round1(okAvg - lowAvg),
    lowAvg: round1(lowAvg),
    okAvg: round1(okAvg),
    sample: closed.length,
  };
}

/** Correlação emoção x energia do dia seguinte. */
export function emotionCorrelation(data: AppData, emotion: string) {
  const closed = closedDays(data.days);
  const map = new Map(closed.map((d) => [d.date, d]));
  const withEmotion = closed.filter((d) => d.diary.emotions.includes(emotion));
  if (withEmotion.length < 3) return null;
  const nextEnergies: number[] = [];
  const otherEnergies: number[] = [];
  for (const d of closed) {
    const next = map.get(addDays(d.date, 1));
    if (!next) continue;
    const e = (next.energy.physical + next.energy.mental) / 2;
    if (d.diary.emotions.includes(emotion)) nextEnergies.push(e);
    else otherEnergies.push(e);
  }
  const a = avg(nextEnergies);
  const b = avg(otherEnergies);
  if (a == null || b == null || b === 0) return null;
  return { emotion, drop: Math.round(((b - a) / b) * 100), sample: withEmotion.length };
}

export function emotionsHeatmap(data: AppData) {
  const counts = new Map<string, number>();
  for (const d of closedDays(data.days)) {
    for (const e of d.diary.emotions) counts.set(e, (counts.get(e) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** Checagem de honestidade (regra 11): questiona, não acusa. */
export interface HonestyFlag {
  goalId: string;
  date: string;
  reason: string;
  detail: string;
}

/**
 * Resolução já gravada de uma checagem (persistida em day.honestyFlags).
 * Sem isso o app mostrava o botão "Confirmar/Ajustar" e nada acontecia:
 * a UI lista via honestyChecks (calculado), mas resolve por goalId+date.
 */
export function resolutionFor(data: AppData, date: string, goalId: string): 'confirmed' | 'adjusted' | null {
  const flags = data.days.find((d) => d.date === date)?.honestyFlags ?? [];
  return flags.find((f) => f.goalId === goalId && f.resolved)?.resolved ?? null;
}

export function honestyChecks(data: AppData): HonestyFlag[] {
  const flags: HonestyFlag[] = [];
  const closed = closedDays(data.days);
  const typical = new Map<string, number>();

  for (const day of closed) {
    for (const t of day.tasks) {
      if (!t.done || !t.doneAt) continue;
      const start = parseInt(t.doneAt.slice(0, 2), 10);
      const list = typical.get(t.goalId) ?? 0;
      typical.set(t.goalId, list + start);
    }
  }

  // "Últimos 14 dias" por calendário, não por posição: com buracos no histórico o
  // slice(-14) trazia meses de distância e misturava períodos diferentes.
  const anchorDate = closed.length ? closed[closed.length - 1]!.date : todayKey();
  const from14 = addDays(anchorDate, -13);
  const recent = closed.filter((d) => d.date >= from14 && d.date <= anchorDate);
  for (const day of recent) {
    for (const t of day.tasks) {
      if (!t.done) continue;
      const goal = data.goals.find((g) => g.id === t.goalId);
      if (!goal) continue;
      const lowEnergy = (day.energy.physical + day.energy.mental) / 2 < 3;
      const isHigh = goal.priority === 'high';
      const longDuration = /(\d+)\s*h/.test(goal.excellent) && parseInt(/(\d+)\s*h/.exec(goal.excellent)?.[1] ?? '0', 10) >= 1;
      if (lowEnergy && isHigh && longDuration) {
        flags.push({
          goalId: t.goalId,
          date: day.date,
          reason: 'energia baixa + tarefa alta + duração longa',
          detail: `Energia ${(day.energy.physical + day.energy.mental) / 2}/10 no dia | meta excelente ${goal.excellent}`,
        });
      }
    }
  }

  // Duração declarada vs típica (usa notas com "2h" e pomodoros).
  for (const day of recent) {
    for (const t of day.tasks) {
      if (!t.done) continue;
      const declared = /(\d+(?:[.,]\d+)?)\s*h/.exec(t.note ?? '');
      const pomodoroMin = (day.pomodoros ?? []).filter((p) => p.goalId === t.goalId).reduce((a, b) => a + b.minutes, 0);
      if (declared && pomodoroMin > 0) {
        const declaredMin = parseFloat((declared[1] ?? '0').replace(',', '.')) * 60;
        if (declaredMin > pomodoroMin * 2 && pomodoroMin >= 25) {
          flags.push({
            goalId: t.goalId,
            date: day.date,
            reason: 'duração declarada vs cronômetro',
            detail: `Declarado ${declared[0]} | Pomodoro registrado ${pomodoroMin}min`,
          });
        }
      }
    }
  }

  // Checagem já respondida não volta a incomodar (e não penaliza o score de novo).
  return flags.filter((f) => !resolutionFor(data, f.date, f.goalId)).slice(0, 5);
}

/** Fila de "dias para desbloquear recompensa" para o dashboard. */
export function nextReward(data: AppData): { name: string; remaining: number } | null {
  const pending = data.rewards
    .filter((r) => !r.unlocked)
    .map((r) => ({ name: r.name, remaining: Math.max(0, r.target - r.current) }))
    .sort((a, b) => a.remaining - b.remaining);
  return pending[0] ?? null;
}

/** Consistência por área (0-10) numa janela de dias. */
export function areaConsistency(data: AppData, dates: string[]): { area: string; score: number | null; done: number; total: number }[] {
  const set = new Set(dates);
  const days = data.days.filter((d) => set.has(d.date));
  return Array.from(new Set(data.goals.map((g) => g.area))).map((area) => {
    const ids = new Set(data.goals.filter((g) => g.area === area).map((g) => g.id));
    let total = 0;
    let done = 0;
    for (const day of days) {
      for (const t of day.tasks) {
        if (!ids.has(t.goalId)) continue;
        total += 1;
        if (t.done) done += 1;
      }
    }
    return { area, total, done, score: total ? round1((done / total) * 10) : null };
  });
}

/** Dias disponíveis para o usuário começar (primeiro dia de dados). */
export function firstDataDate(data: AppData): string | null {
  const all = data.days.filter((d) => d.tasks.length || d.closedAt).map((d) => d.date).sort();
  return all[0] ?? null;
}

export function daysSince(dateKey: string): number {
  let count = 0;
  let cursor = todayKey();
  while (cursor > dateKey && count < 1000) {
    cursor = addDays(cursor, -1);
    count += 1;
  }
  return count;
}

export function last7Keys(): string[] {
  return lastNDays(7);
}

export type { Day, Goal };

/**
 * Divergência sem acusar (regra 11): o que foi declarado no diário não bate com o checklist.
 * Não é fraude presumida — é convite a olhar o registro.
 */
export interface Divergence {
  date: string;
  kind: 'declared-not-done' | 'done-not-declared';
  detail: string;
}

export function declarationDivergences(data: AppData): Divergence[] {
  const out: Divergence[] = [];
  for (const d of closedDays(data.days)) {
    const declaredDone = d.diary.done.trim().length > 0;
    const doneTasks = d.tasks.filter((t) => t.done).length;
    const undone = d.tasks.filter((t) => !t.done).length;
    if (!d.tasks.length) continue;
    // Declarou execução no diário, mas nenhuma tarefa marcada (e há tarefas abertas).
    if (declaredDone && doneTasks === 0 && undone > 0) {
      out.push({
        date: d.date,
        kind: 'declared-not-done',
        detail: 'O diário descreve execução, mas nenhuma tarefa do checklist foi marcada.',
      });
      continue;
    }
    // Marcou tudo como feito e escreveu que nada foi feito.
    if (doneTasks === d.tasks.length && undone === 0 && /nada|não fiz|nao fiz/i.test(d.diary.done) ) {
      out.push({
        date: d.date,
        kind: 'done-not-declared',
        detail: 'Todas as tarefas estão marcadas, mas o diário diz que nada foi feito.',
      });
    }
  }
  return out.slice(0, 5);
}
