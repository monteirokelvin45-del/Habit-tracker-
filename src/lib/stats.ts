import type { AppData, Day, Goal } from './types';
import { addDays, lastNDays, monthKey, todayKey, weekdayIndex, weekStart } from './date';
import { buildChecklist, generalStreak, goalForTask, goalStreak, round1 } from './score';

/**
 * Métricas dos gráficos — funções PURAS sobre AppData.
 *
 * Regras do produto que valem aqui (e são testadas):
 *  - sem dado não vira zero: dia sem registro fica `null`, nunca 0;
 *  - nada de interpolar buraco (a linha quebra);
 *  - padrão só com >= 7 dias de dado (regra 4).
 */

/* ─────────────────────────────── helpers ─────────────────────────────── */

/** Dia "conta" quando foi fechado (tem score) — é o que o app considera registrado. */
export function isRecorded(day: Day | undefined): boolean {
  return !!day?.score;
}

/** Sequência de segundos entre dias (para achar lacunas / melhores séries). */
function consecutive(a: string, b: string): boolean {
  return addDays(a, 1) === b;
}

/* ───────────────────────── 1. calendário (heatmap) ───────────────────────── */

export interface CalendarCell {
  date: string;
  score: number | null;
  recorded: boolean;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * Calendário em grade mensal (semanas seg→dom), do mês do mês anterior até o mês pedido.
 * `null` = sem registro. Não inventa dia fora do mês — a célula existe para alinhar a grade.
 */
export function calendarMonth(days: Day[], reference = todayKey()): { weeks: CalendarCell[][]; monthLabel: string } {
  const year = Number(reference.slice(0, 4));
  const month = Number(reference.slice(5, 7)) - 1;
  const byDate = new Map(days.map((d) => [d.date, d]));
  const first = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const start = weekStart(first);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const day = byDate.get(date);
      week.push({
        date,
        score: day?.score?.total ?? null,
        recorded: isRecorded(day),
        isToday: date === reference,
        isFuture: date > reference,
      });
    }
    weeks.push(week);
  }
  return { weeks, monthLabel: first.slice(0, 7) };
}

/* ─────────────────────── 2. streak atual vs recorde ─────────────────────── */

export interface StreakInfo {
  current: number;
  best: number;
  bestStart: string | null;
  bestEnd: string | null;
  /** Série de 0/1 nos últimos n dias, para a barrinha. */
  series: { date: string; ok: boolean }[];
}

export function streakInfo(days: Day[], opts?: { end?: string; window?: number }): StreakInfo {
  const end = opts?.end ?? todayKey();
  const window = opts?.window ?? 30;
  const closed = days.filter((d) => d.score).sort((a, b) => (a.date < b.date ? -1 : 1));

  let best = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  let run = 0;
  let runStart: string | null = null;
  let prev: string | null = null;

  for (const day of closed) {
    const ok = (day.score?.total ?? 0) > 5;
    if (!ok) {
      run = 0;
      runStart = null;
      prev = day.date;
      continue;
    }
    if (run > 0 && prev && consecutive(prev, day.date)) {
      run += 1;
    } else {
      run = 1;
      runStart = day.date;
    }
    if (run > best) {
      best = run;
      bestStart = runStart;
      bestEnd = day.date;
    }
    prev = day.date;
  }

  const windowDays = lastNDays(window, end);
  const map = new Map(days.map((d) => [d.date, d]));
  return {
    current: generalStreak(days, end),
    best,
    bestStart,
    bestEnd,
    series: windowDays.map((date) => ({ date, ok: (map.get(date)?.score?.total ?? 0) > 5 })),
  };
}

/* ───────────────────── 3/4. barras semanais e mensais ───────────────────── */

export interface Bucket {
  key: string;
  label: string;
  /** Média de score dos dias registrados. `null` = nenhum registro no período. */
  avgScore: number | null;
  /** % de tarefas concluídas no período. */
  completion: number | null;
  recorded: number;
  total: number;
}

export function weeklyBuckets(days: Day[], weeks = 8, end = todayKey()): Bucket[] {
  const out: Bucket[] = [];
  const thisWeek = weekStart(end);
  for (let w = weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    const keys = Array.from({ length: 7 }, (_, i) => addDays(start, i));
    out.push(bucketFor(days, keys, start, `S${labelOfWeek(start)}`));
  }
  return out;
}

export function monthlyBuckets(days: Day[], months = 6, end = todayKey()): Bucket[] {
  const out: Bucket[] = [];
  const [year, month] = [Number(end.slice(0, 4)), Number(end.slice(5, 7))];
  const labels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(year, month - 1 - i, 1, 12);
    const y = d.getFullYear();
    const m = d.getMonth();
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const keys = Array.from({ length: daysInMonth }, (_, k) => `${key}-${String(k + 1).padStart(2, '0')}`);
    out.push(bucketFor(days, keys, key, labels[m] ?? key));
  }
  return out;
}

function labelOfWeek(startKey: string): string {
  return startKey.slice(8, 10);
}

function bucketFor(days: Day[], keys: string[], key: string, label: string): Bucket {
  const set = new Set(keys);
  const inRange = days.filter((d) => set.has(d.date));
  const scored = inRange.filter((d) => d.score);
  const tasks = inRange.flatMap((d) => d.tasks);
  const done = tasks.filter((t) => t.done).length;
  return {
    key,
    label,
    avgScore: scored.length ? round1(scored.reduce((a, b) => a + (b.score?.total ?? 0), 0) / scored.length) : null,
    completion: tasks.length ? Math.round((done / tasks.length) * 100) : null,
    recorded: scored.length,
    total: keys.length,
  };
}

/* ───────────────────────── 5. anel de progresso ───────────────────────── */

export function dailyProgress(day: Day | undefined, goals: Goal[]): { done: number; total: number; ratio: number } {
  if (!day) return { done: 0, total: 0, ratio: 0 };
  const checklist = buildChecklist(goals, day.mode);
  // O anel mede o checklist do modo atual. Item de outro modo que ficou no histórico
  // inflava o numerador (3 feitas em 2 tarefas).
  const keys = new Set(checklist.map((i) => i.extraKey ?? i.goal.id));
  const total = checklist.length;
  const done = day.tasks.filter((t) => t.done && keys.has(t.goalId)).length;
  return { done, total, ratio: total ? done / total : 0 };
}

/* ───────────────────── 6. grade por dia da semana ───────────────────── */

export interface WeekdayStat {
  /** 1 = segunda … 7 = domingo (mais legível que 0 = domingo). */
  weekday: number;
  label: string;
  avgScore: number | null;
  completion: number | null;
  samples: number;
}

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export function weekdayGrid(days: Day[], window = 56, end = todayKey()): WeekdayStat[] {
  const keys = new Set(lastNDays(window, end));
  const buckets: { scores: number[]; done: number; total: number }[] = WEEKDAY_LABELS.map(() => ({
    scores: [],
    done: 0,
    total: 0,
  }));

  for (const day of days) {
    if (!keys.has(day.date)) continue;
    const iso = ((weekdayIndex(day.date) + 6) % 7); // 0 = segunda
    const b = buckets[iso]!;
    if (day.score) b.scores.push(day.score.total);
    b.done += day.tasks.filter((t) => t.done).length;
    b.total += day.tasks.length;
  }

  return buckets.map((b, i) => ({
    weekday: i + 1,
    label: WEEKDAY_LABELS[i]!,
    avgScore: b.scores.length ? round1(b.scores.reduce((a, c) => a + c, 0) / b.scores.length) : null,
    completion: b.total ? Math.round((b.done / b.total) * 100) : null,
    samples: b.scores.length,
  }));
}

/* ────────────── 7. linha de conclusão com média móvel ────────────── */

export interface MovingPoint {
  date: string;
  /** % de conclusão do dia (null se o dia não tem tarefas). */
  value: number | null;
  /** Média móvel das últimas `window` observações válidas. */
  average: number | null;
}

export function completionWithAverage(days: Day[], opts?: { n?: number; window?: number; end?: string }): MovingPoint[] {
  const n = opts?.n ?? 30;
  const window = opts?.window ?? 7;
  const end = opts?.end ?? todayKey();
  const map = new Map(days.map((d) => [d.date, d]));

  const points: MovingPoint[] = lastNDays(n, end).map((date) => {
    const day = map.get(date);
    const tasks = day?.tasks ?? [];
    return {
      date,
      value: tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : null,
      average: null,
    };
  });

  // Média móvel só sobre valores reais: buraco não puxa a média para baixo.
  const validSoFar: number[] = [];
  for (const p of points) {
    if (p.value != null) validSoFar.push(p.value);
    if (validSoFar.length >= 3) {
      const slice = validSoFar.slice(-window);
      p.average = Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
    }
  }
  return points;
}

/* ────────────── 8. barras com linha de meta ────────────── */

export interface GoalBar {
  label: string;
  value: number | null;
  target: number;
}

/** Consistência por área (0-100) contra a meta diária do usuário (score 0-10 ⇒ ×10). */
export function areaVsTarget(data: AppData, window = 14, end = todayKey()): GoalBar[] {
  const keys = new Set(lastNDays(window, end));
  const target = Math.round((data.settings.targetDailyScore ?? 7) * 10);
  const areas = Array.from(new Set(data.goals.filter((g) => g.active && !g.archived).map((g) => g.area)));

  return areas.map((area) => {
    const ids = new Set(data.goals.filter((g) => g.area === area).map((g) => g.id));
    let done = 0;
    let total = 0;
    for (const day of data.days) {
      if (!keys.has(day.date)) continue;
      for (const t of day.tasks) {
        const goal = goalForTask(data.goals, t);
        if (!goal || !ids.has(goal.id)) continue;
        total += 1;
        if (t.done) done += 1;
      }
    }
    return { label: area, value: total ? Math.round((done / total) * 100) : null, target };
  });
}

/* ────────────── 9. linha de tendência (regressão) ────────────── */

export interface TrendInfo {
  /** Pontos com score, em ordem. */
  points: { date: string; value: number }[];
  /** Inclinação por dia (pontos de score por dia). */
  slope: number;
  /** Linha projetada (mesma escala do gráfico) para desenhar. */
  projection: { date: string; value: number }[];
  direction: 'up' | 'down' | 'flat';
  /** Só é `true` com >= 7 dias: antes disso é ruído, não tendência. */
  reliable: boolean;
}

export function trendLine(days: Day[], opts?: { n?: number; end?: string; flatThreshold?: number }): TrendInfo {
  const n = opts?.n ?? 30;
  const end = opts?.end ?? todayKey();
  const keys = new Set(lastNDays(n, end));
  const points = days
    .filter((d) => d.score && keys.has(d.date))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d, i) => ({ date: d.date, value: d.score!.total, i }));

  const count = points.length;
  if (count < 2) {
    return { points: points.map(({ date, value }) => ({ date, value })), slope: 0, projection: [], direction: 'flat', reliable: false };
  }

  const xs = points.map((p) => p.i);
  const ys = points.map((p) => p.value);
  const meanX = xs.reduce((a, b) => a + b, 0) / count;
  const meanY = ys.reduce((a, b) => a + b, 0) / count;
  let num = 0;
  let den = 0;
  for (let i = 0; i < count; i++) {
    num += (xs[i]! - meanX) * (ys[i]! - meanY);
    den += (xs[i]! - meanX) ** 2;
  }
  const slope = den ? num / den : 0;
  const threshold = opts?.flatThreshold ?? 0.02;
  const direction = slope > threshold ? 'up' : slope < -threshold ? 'down' : 'flat';

  const projection = points.map((p) => ({
    date: p.date,
    value: Math.max(0, Math.min(10, Math.round((meanY + slope * (p.i - meanX)) * 10) / 10)),
  }));

  return { points: points.map(({ date, value }) => ({ date, value })), slope: Math.round(slope * 100) / 100, projection, direction, reliable: count >= 7 };
}

/* ────────────── 10. linha cumulativa ────────────── */

export interface CumulativePoint {
  date: string;
  /** Tarefas concluídas acumuladas até o dia (nunca cai). */
  done: number | null;
}

export function cumulativeDone(days: Day[], opts?: { n?: number; end?: string }): CumulativePoint[] {
  const n = opts?.n ?? 30;
  const end = opts?.end ?? todayKey();
  const map = new Map(days.map((d) => [d.date, d]));
  // Começa do total anterior à janela para a curva não "voltar a zero" na virada.
  const windowStart = addDays(end, -(n - 1));
  let running = days
    .filter((d) => d.date < windowStart)
    .reduce((acc, d) => acc + d.tasks.filter((t) => t.done).length, 0);

  return lastNDays(n, end).map((date) => {
    const day = map.get(date);
    if (!day) return { date, done: null };
    running += day.tasks.filter((t) => t.done).length;
    return { date, done: running };
  });
}

/* ────────────── 11. radar de equilíbrio ────────────── */

export interface RadarPoint {
  label: string;
  area: string;
  /** 0-10 (média de conclusão da área na janela). `null` = sem dado. */
  value: number | null;
}

export function areaBalance(data: AppData, window = 14, end = todayKey()): RadarPoint[] {
  const keys = new Set(lastNDays(window, end));
  const areas = Array.from(new Set(data.goals.filter((g) => g.active && !g.archived).map((g) => g.area)));

  return areas.map((area) => {
    const ids = new Set(data.goals.filter((g) => g.area === area).map((g) => g.id));
    let done = 0;
    let total = 0;
    for (const day of data.days) {
      if (!keys.has(day.date)) continue;
      for (const t of day.tasks) {
        const goal = goalForTask(data.goals, t);
        if (!goal || !ids.has(goal.id)) continue;
        total += 1;
        if (t.done) done += 1;
      }
    }
    return { label: area, area, value: total ? round1((done / total) * 10) : null };
  });
}

/* ────────────── 12. ranking horizontal de hábitos ────────────── */

export interface HabitRank {
  goalId: string;
  name: string;
  area: string;
  /** % de conclusão na janela. */
  pct: number | null;
  done: number;
  total: number;
  streak: number;
}

export function habitRanking(data: AppData, window = 30, end = todayKey()): HabitRank[] {
  const keys = new Set(lastNDays(window, end));
  const result: HabitRank[] = data.goals
    .filter((g) => g.active && !g.archived)
    .map((goal) => {
      let done = 0;
      let total = 0;
      for (const day of data.days) {
        if (!keys.has(day.date)) continue;
        for (const t of day.tasks) {
          const g = goalForTask(data.goals, t);
          if (g?.id !== goal.id) continue;
          total += 1;
          if (t.done) done += 1;
        }
      }
      return {
        goalId: goal.id,
        name: goal.name,
        area: goal.area,
        pct: total ? Math.round((done / total) * 100) : null,
        done,
        total,
        streak: goalStreakSafe(data.days, goal.id, end),
      };
    });

  return result.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
}

function goalStreakSafe(days: Day[], goalId: string, end: string): number {
  // Mesma regra do app (dia sem o item encerra a sequência) — sem reimplementação paralela.
  return goalStreak(days, goalId, end);
}

/* ────────────── 13. heatmap por hora ────────────── */

export interface HourCell {
  hour: number;
  done: number;
  failed: number;
}

export function hourHeatmap(days: Day[]): HourCell[] {
  const cells: HourCell[] = Array.from({ length: 24 }, (_, hour) => ({ hour, done: 0, failed: 0 }));
  for (const day of days) {
    for (const t of day.tasks) {
      const stamp = t.done ? t.doneAt : t.failAt;
      if (!stamp) continue;
      const hour = Number(stamp.slice(0, 2));
      if (!Number.isFinite(hour) || hour < 0 || hour > 23) continue;
      if (t.done) cells[hour]!.done += 1;
      else cells[hour]!.failed += 1;
    }
  }
  return cells;
}

/* ────────────── 14. dispersão hábito × humor/energia ────────────── */

export interface ScatterPoint {
  date: string;
  x: number;
  y: number;
  /** Quantos itens foram cumpridos no dia (tamanho da bolha). */
  tasks: number;
}

export function scatterEnergy(days: Day[], axis: 'energy' | 'mood' = 'energy'): {
  points: ScatterPoint[];
  correlation: number | null;
} {
  const points: ScatterPoint[] = [];
  for (const day of days) {
    const tasks = day.tasks;
    if (!tasks.length) continue;
    const completion = Math.round((tasks.filter((t) => t.done).length / tasks.length) * 10);
    let x: number | null = null;
    if (axis === 'energy') {
      x = round1((day.energy.physical + day.energy.mental) / 2);
    } else {
      const mood = moodToNumber(day.diary.mood);
      x = mood;
    }
    if (x == null) continue;
    points.push({ date: day.date, x, y: completion, tasks: tasks.length });
  }

  const correlation = pearson(
    points.map((p) => p.x),
    points.map((p) => p.y),
  );
  return { points, correlation: points.length >= 7 ? correlation : null };
}

/** Emoji do humor → 1..5 (mesma escala usada no diário). */
export function moodToNumber(mood: string): number | null {
  const table: Record<string, number> = { '😄': 5, '🙂': 4, '😐': 3, '😕': 2, '😞': 1, '😡': 1, '😴': 2 };
  if (table[mood]) return table[mood]!;
  const n = Number(String(mood).replace(',', '.'));
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    dx += (xs[i]! - mx) ** 2;
    dy += (ys[i]! - my) ** 2;
  }
  if (!dx || !dy) return null;
  return Math.round((num / Math.sqrt(dx * dy)) * 100) / 100;
}

/* ────────────── 15. barras empilhadas (concluído/pulado/falhou) ────────────── */

export interface StackDay {
  date: string;
  label: string;
  done: number;
  skipped: number;
  failed: number;
}

/**
 * "Pulado" = tarefa não feita sem desculpa registrada (o dia passou).
 * "Falhou" = não feita COM desculpa registrada (o usuário assumiu a falha).
 * A distinção é justamente o que o app cobra: registrar a falha.
 */
export function stackedTasks(days: Day[], n = 14, end = todayKey()): StackDay[] {
  const map = new Map(days.map((d) => [d.date, d]));
  return lastNDays(n, end).map((date) => {
    const day = map.get(date);
    const tasks = day?.tasks ?? [];
    return {
      date,
      label: date.slice(8, 10),
      done: tasks.filter((t) => t.done).length,
      skipped: tasks.filter((t) => !t.done && !t.excuse).length,
      failed: tasks.filter((t) => !t.done && !!t.excuse).length,
    };
  });
}

/* ────────────── 16. timeline de conclusões ────────────── */

export interface TimelineItem {
  at: string;
  date: string;
  label: string;
  area: string;
  kind: 'done' | 'failed';
}

export function timeline(days: Day[], goals: Goal[], limit = 12): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const day of days) {
    for (const t of day.tasks) {
      const stamp = t.done ? t.doneAt : t.failAt;
      if (!stamp) continue;
      const goal =
        goals.find((g) => g.id === t.goalId) ??
        goals.find((g) => (g as Goal & { originId?: string }).originId === t.goalId);
      items.push({
        at: stamp,
        date: day.date,
        label: goal?.name ?? (t.goalId.startsWith('extra:') ? 'Tarefa extra' : 'Tarefa'),
        area: goal?.area ?? '—',
        kind: t.done ? 'done' : 'failed',
      });
    }
  }
  // Mais recente primeiro: data desc, hora desc.
  return items
    .sort((a, b) => (a.date === b.date ? (a.at < b.at ? 1 : -1) : a.date < b.date ? 1 : -1))
    .slice(0, limit);
}

/* ────────────── 17. bolhas (frequência × consistência) ────────────── */

export interface BubblePoint {
  goalId: string;
  name: string;
  area: string;
  /** Frequência: dias com a tarefa cumprida no período. */
  frequency: number;
  /** Consistência: % de conclusão. */
  consistency: number | null;
  /** Tamanho: total de itens no período. */
  volume: number;
}

export function bubbleHabits(data: AppData, window = 30, end = todayKey()): BubblePoint[] {
  const keys = new Set(lastNDays(window, end));
  return data.goals
    .filter((g) => g.active && !g.archived)
    .map((goal) => {
      let done = 0;
      let total = 0;
      const daysWith = new Set<string>();
      for (const day of data.days) {
        if (!keys.has(day.date)) continue;
        for (const t of day.tasks) {
          const g = goalForTask(data.goals, t);
          if (g?.id !== goal.id) continue;
          total += 1;
          if (t.done) {
            done += 1;
            daysWith.add(day.date);
          }
        }
      }
      return {
        goalId: goal.id,
        name: goal.name,
        area: goal.area,
        frequency: daysWith.size,
        consistency: total ? Math.round((done / total) * 100) : null,
        volume: total,
      };
    });
}

/* ────────────── 18. waffle chart ────────────── */

export interface WaffleCell {
  index: number;
  date: string | null;
  state: 'done' | 'partial' | 'missed' | 'future';
}

/**
 * Grade de 100 quadradinhos = janela de 100 dias (como um "waffle" de progresso).
 * Usado para responder "de 100 dias, quantos eu realmente fechei".
 */
export function waffle(days: Day[], n = 100, end = todayKey()): { cells: WaffleCell[]; done: number; partial: number } {
  const map = new Map(days.map((d) => [d.date, d]));
  const keys = lastNDays(n, end);
  let done = 0;
  let partial = 0;
  const cells: WaffleCell[] = keys.map((date, index) => {
    const day = map.get(date);
    if (date > end) return { index, date: null, state: 'future' };
    if (!day?.score) return { index, date, state: 'missed' };
    if (day.score.total >= 6) {
      done += 1;
      return { index, date, state: 'done' };
    }
    partial += 1;
    return { index, date, state: 'partial' };
  });
  return { cells, done, partial };
}

/* ────────────── 19. sparkline por hábito ────────────── */

/** Últimos n dias: 1 = feita, 0 = não feita, `null` = dia sem o item. */
export function sparkline(data: AppData, goalId: string, n = 14, end = todayKey()): { date: string; value: number | null }[] {
  const map = new Map(data.days.map((d) => [d.date, d]));
  return lastNDays(n, end).map((date) => {
    const day = map.get(date);
    const task = day?.tasks.find((t) => {
      const g = goalForTask(data.goals, t);
      return g?.id === goalId;
    });
    if (!task) return { date, value: null };
    return { date, value: task.done ? 1 : 0 };
  });
}

/* ────────────── 20. gauge de meta mensal ────────────── */

export interface GaugeInfo {
  /** 0..1+ (pode passar de 1). */
  ratio: number;
  current: number;
  target: number;
  label: string;
  onTrack: boolean;
  /** Dias restantes no mês (para saber se está no ritmo). */
  daysLeft: number;
  /** Projeção simples de fechamento do mês. */
  projection: number;
}

/** Meta mensal = dias com score >= meta diária, no mês corrente. */
export function monthlyGauge(data: AppData, end = todayKey()): GaugeInfo {
  const mk = monthKey(end);
  const year = Number(end.slice(0, 4));
  const month = Number(end.slice(5, 7));
  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = Number(end.slice(8, 10));
  const target = daysInMonth;
  const floor = data.settings.targetDailyScore ?? 7;

  const current = data.days.filter((d) => d.date.startsWith(mk) && (d.score?.total ?? 0) >= floor).length;
  const daysLeft = Math.max(0, daysInMonth - dayOfMonth);
  const ratio = target ? current / target : 0;
  const expectedByNow = dayOfMonth / daysInMonth;
  return {
    ratio,
    current,
    target,
    label: `${current}/${target} dias na meta`,
    onTrack: ratio >= expectedByNow - 0.05,
    daysLeft,
    // Projeção = ritmo atual × dias do mês, limitada ao alvo. Mês sem nenhum dia
    // cumprido projeta 0 (antes o texto caía em "sem projeção").
    projection: dayOfMonth ? Math.min(target, Math.round((current / dayOfMonth) * daysInMonth)) : 0,
  };
}

/* ────────────── 21. distribuição por categoria ────────────── */

export interface Slice {
  label: string;
  value: number;
}

/** Distribuição das tarefas concluídas por área (o "por categoria" do app). */
export function categoryDistribution(data: AppData, window = 30, end = todayKey()): Slice[] {
  const keys = new Set(lastNDays(window, end));
  const counts = new Map<string, number>();
  for (const day of data.days) {
    if (!keys.has(day.date)) continue;
    for (const t of day.tasks) {
      if (!t.done) continue;
      const goal = goalForTask(data.goals, t);
      const label = goal?.area ?? 'Extra';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Minutos de foco do dia (pomodoros registrados).
 * `null` quando o dia não existe — diferente de "focou 0 minutos".
 */
export function focusMinutes(day: { pomodoros?: { minutes: number }[] } | undefined): number | null {
  if (!day) return null;
  return (day.pomodoros ?? []).reduce((sum, p) => sum + (p.minutes || 0), 0);
}

/** Média diária de foco nos dias com registro (para comparar com hoje). */
export function averageFocusMinutes(days: { pomodoros?: { minutes: number }[] }[], window = 7): number | null {
  const withFocus = days
    .filter((d) => Array.isArray(d.pomodoros))
    .map((d) => (d.pomodoros ?? []).reduce((s, p) => s + (p.minutes || 0), 0))
    .filter((m) => m > 0)
    .slice(-window);
  if (!withFocus.length) return null;
  return Math.round(withFocus.reduce((a, b) => a + b, 0) / withFocus.length);
}
