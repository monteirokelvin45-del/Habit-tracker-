import type { Day, DayMode, Goal, Priority, ScoreBreakdown, Settings } from './types';
import { addDays, formatMinutes, parseDurationToMinutes, todayKey } from './date';


/* ──────────────────── Resolução de tarefas (ids x extras) ──────────────────── */

/** Chaves de tarefa válidas para uma meta: o id atual e o id de origem ("goal:slug"). */
function goalKeys(goal: Goal): string[] {
  const keys = [goal.id];
  const origin = (goal as Goal & { originId?: string }).originId;
  if (origin && !keys.includes(origin)) keys.push(origin);
  return keys;
}

/** Id de origem de uma tarefa (quando o importador gerou um id novo para a meta). */
export function taskGoalId(task: { goalId: string }): string {
  return task.goalId;
}

/**
 * Encontra a meta de uma tarefa. Uma tarefa "extra:" (modo ataque/recuperação)
 * não pertence a nenhuma meta — usar a área dela como fallback faria uma meta
 * aleatória ser marcada como feita/falhada.
 */
export function goalForTask(goals: Goal[], task: { goalId: string }): Goal | undefined {
  if (task.goalId.startsWith('extra:')) return undefined;
  return goals.find((g) => goalKeys(g).includes(task.goalId));
}

/* ────────────────────────────── Checklist por modo ────────────────────────────── */


export interface ChecklistItem {
  goal: Goal;
  /** Versão do padrão que o modo atual exige. */
  level: 'min' | 'ideal' | 'excellent';
  /** Texto da meta correspondente (ex: "1h"). */
  target: string;
  /** Tarefa extra sugerida (modo ataque / plano de retorno). */
  extra?: boolean;
  extraKey?: string;
}

/**
 * Regra 9: o modo do dia altera o checklist.
 * NORMAL  → todas ativas no "ideal"
 * MÍNIMO  → só "mínimo", esconde prioridade baixa
 * ATAQUE  → todas no "excelente" + extras sugeridas
 * RECUPERAÇÃO → só prioridade alta no mínimo + plano de retorno
 */
export function buildChecklist(goals: Goal[], mode: DayMode): ChecklistItem[] {
  const active = goals.filter((g) => g.active && !g.archived);
  const items: ChecklistItem[] = [];

  for (const goal of active) {
    if (mode === 'minimal') {
      if (goal.priority === 'low') continue;
      items.push({ goal, level: 'min', target: goal.min });
    } else if (mode === 'attack') {
      items.push({ goal, level: 'excellent', target: goal.excellent });
    } else if (mode === 'recovery') {
      if (goal.priority !== 'high') continue;
      items.push({ goal, level: 'min', target: goal.min });
    } else {
      items.push({ goal, level: 'ideal', target: goal.ideal });
    }
  }

  if (mode === 'attack') {
    items.push({
      goal: {
        id: 'extra:revisao',
        name: 'Revisar o que travou ontem',
        area: active[0]?.area ?? 'Projeto Pessoal',
        priority: 'normal',
        min: '5min',
        ideal: '10min',
        excellent: '15min',
        active: true,
        createdAt: '',
      },
      level: 'excellent',
      target: '15min',
      extra: true,
      extraKey: 'extra:revisao',
    });
    items.push({
      goal: {
        id: 'extra:prep',
        name: 'Preparar amanhã hoje (3 min)',
        area: active[0]?.area ?? 'Projeto Pessoal',
        priority: 'normal',
        min: '3min',
        ideal: '3min',
        excellent: '3min',
        active: true,
        createdAt: '',
      },
      level: 'excellent',
      target: '3min',
      extra: true,
      extraKey: 'extra:prep',
    });
  }

  if (mode === 'recovery') {
    items.push({
      goal: {
        id: 'extra:retorno',
        name: 'Plano de retorno: 1 micro-vitória antes das 12h',
        area: active[0]?.area ?? 'Saúde',
        priority: 'high',
        min: '10min',
        ideal: '15min',
        excellent: '20min',
        active: true,
        createdAt: '',
      },
      level: 'min',
      target: '10min',
      extra: true,
      extraKey: 'extra:retorno',
    });
  }

  return items;
}

export function taskKeyFor(item: ChecklistItem): string {
  return item.extraKey ?? item.goal.id;
}

/* ────────────────────────────── Modo sugerido ────────────────────────────── */

export function suggestMode(energy: { physical: number; mental: number }, yesterdayScore?: number): {
  mode: DayMode;
  reason: string;
} {
  const avg = (energy.physical + energy.mental) / 2;
  if (typeof yesterdayScore === 'number' && yesterdayScore < 4) {
    return { mode: 'recovery', reason: 'o score de ontem ficou abaixo de 4' };
  }
  if (avg < 4) return { mode: 'minimal', reason: 'energia baixa' };
  if (avg > 7) return { mode: 'attack', reason: 'energia alta' };
  return { mode: 'normal', reason: 'energia equilibrada' };
}

/* ────────────────────────────── Streaks ────────────────────────────── */

export function goalStreak(days: Day[], goalId: string, end: string | null = todayKey()): number {
  const map = new Map(days.map((d) => [d.date, d]));
  if (!end) return 0;
  let streak = 0;
  let cursor: string = end;
  for (let i = 0; i < 400; i++) {
    const day = map.get(cursor);
    const task = day?.tasks.find((t) => t.goalId === goalId);
    if (!day || !task) {
      // dia sem esse item no checklist: não quebra se o dia foi fechado? Quebra — coerência manda.
      if (i === 0) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    if (task.done) streak++;
    else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function generalStreak(days: Day[], end: string | null = todayKey()): number {
  const map = new Map(days.map((d) => [d.date, d]));
  if (!end) return 0;
  let streak = 0;
  let cursor: string = end;
  // Hoje ainda não registrado (ou ontem pendente) não pode zerar a série:
  // só pulamos a lacuna no início da contagem, como já fazia goalStreak.
  for (let i = 0; i < 500; i++) {
    const day = map.get(cursor);
    if (!day || !day.score) {
      if (i === 0 || (i === 1 && !map.get(end)?.score)) {
        cursor = addDays(cursor, -1);
        continue;
      }
      break;
    }
    if (day.score.total > 5) streak++;
    else break;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function continuityFactor(streak: number): number {
  if (streak >= 14) return 10;
  if (streak >= 7) return 8;
  if (streak >= 3) return 6;
  if (streak >= 1) return 4;
  return 0;
}

/* ────────────────────────────── Score ────────────────────────────── */

export interface ScoreInput {
  day: Day;
  goals: Goal[];
  previousDays: Day[];
}

/**
 * Score = média ponderada de 5 fatores (nunca só % de tarefas):
 *  Regularidade 30% · Continuidade 20% · Recuperação 15% · Honestidade 15% · Progresso 20%
 */
export function computeScore({ day, goals, previousDays }: ScoreInput): ScoreBreakdown {
  const byDate = new Map(previousDays.map((d) => [d.date, d]));

  // 1. Regularidade (30%): % das tarefas do checklist concluídas, ponderada por prioridade.
  const weights: Record<Priority, number> = { high: 3, normal: 2, low: 1 };
  let wTotal = 0;
  let wDone = 0;
  for (const t of day.tasks) {
    const goal = goalForTask(goals, t);
    const w = weights[(goal?.priority ?? 'normal') as Priority];
    wTotal += w;
    if (t.done) wDone += w;
  }
  const regularity = wTotal > 0 ? (wDone / wTotal) * 10 : 0;

  // 2. Continuidade (20%): streak de dias com score > 5 (1 dia=4, 3=6, 7=8, 14+=10).
  const prevStreak = generalStreak(previousDays, addDays(day.date, -1));
  const effectiveStreak = regularity >= 5 ? prevStreak + 1 : prevStreak;
  const continuity = continuityFactor(effectiveStreak);

  // 3. Recuperação (15%): falhou ontem e hoje entregou → bônus.
  const yesterday = byDate.get(addDays(day.date, -1));
  const failedYesterday = !!yesterday?.score && yesterday.score.total < 5;
  let recovery = 5;
  if (failedYesterday) recovery = regularity >= 5 ? 10 : 3;
  else recovery = Math.min(10, 5 + (regularity >= 6 ? 2 : 0));

  // 4. Honestidade (15%): preencheu contexto, evitou, atrapalhou e correção.
  const dh = day.diary;
  const filled = [
    dh.context.where.trim().length > 0,
    dh.context.distraction.trim().length > 0 || dh.context.trigger.trim().length > 0,
    dh.avoided.trim().length > 0,
    dh.blocked.trim().length > 0,
    dh.correction.trim().length > 0 || regularity >= 6,
  ].filter(Boolean).length;
  let honesty = (filled / 5) * 8;
  // Bônus só quando o máximo de campos já está preenchido: evita soma acima de 8 com base parcial.
  if (filled === 5 && dh.context.where.trim() && (dh.context.trigger.trim() || dh.context.distraction.trim())) {
    honesty += 2;
  }
  const unresolvedFlags = (day.honestyFlags ?? []).filter((f) => !f.resolved).length;
  honesty = Math.max(0, Math.min(10, honesty - unresolvedFlags * 2));

  // 5. Progresso real (20%): hoje vs média dos últimos 7 dias.
  const recent = previousDays
    .filter((d) => d.date < day.date && d.score)
    .slice(-7)
    .map((d) => d.score?.total ?? 0);
  const avg7 = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : null;
  const progress =
    avg7 == null ? Math.min(10, regularity) : Math.max(0, Math.min(10, regularity + (regularity - avg7) * 1.5));

  const total =
    regularity * 0.3 + continuity * 0.2 + recovery * 0.15 + honesty * 0.15 + progress * 0.2;

  const r1 = (n: number) => Math.round(n * 10) / 10;
  return {
    regularity: r1(Math.min(10, regularity)),
    continuity: r1(continuity),
    recovery: r1(recovery),
    honesty: r1(honesty),
    progress: r1(progress),
    total: r1(Math.max(0, Math.min(10, total))),
  };
}

/* ────────────────────────────── Recompensas / narrativa ────────────────────────────── */

export function priorityTasksUndone(day: Day, goals: Goal[]): { goal: Goal; task: Day['tasks'][number] }[] {
  return day.tasks
    .filter((t) => !t.done)
    .map((task) => ({ task, goal: goalForTask(goals, task) }))
    .filter((x): x is { task: Day['tasks'][number]; goal: Goal } => !!x.goal && x.goal.priority === 'high');
}

export function victoryLine(day: Day, score: number, goals: Goal[]): string {
  const done = day.tasks.filter((t) => t.done);
  const areas = Array.from(
    new Set(done.map((t) => goalForTask(goals, t)?.area).filter((a): a is string => !!a)),
  );
  const area = areas[0] ?? goals[0]?.area ?? 'sua rotina';

  // Regra 2: sem elogio vazio. Sem tarefa concluída, o texto descreve o fato — não parabeniza.
  if (!done.length) {
    return score >= 5
      ? 'Nenhuma tarefa marcada como feita. O score reflete presença no loop, não execução.'
      : 'Dia difícil e sem entrega registrada. O registro existe para corrigir amanhã, não para consolar.';
  }
  if (score > 7) {
    return `Você dominou ${area} hoje. Consistência real: ${done.length} de ${day.tasks.length} entregues sem depender do humor.`;
  }
  if (score >= 5) {
    const firstDone = done[0];
    const name = firstDone ? goalForTask(goals, firstDone)?.name : undefined;
    return `Você não fez tudo, mas avançou no que importava: ${name ?? 'a prioridade do dia'}.`;
  }
  return `Dia difícil, com ${done.length} de ${day.tasks.length} entregues. O registro já permite corrigir.`;
}

export function chargeLines(day: Day, goals: Goal[]): { text: string; goal: Goal; task: Day['tasks'][number] }[] {
  return priorityTasksUndone(day, goals)
    .map(({ goal, task }) => {
      const excuse = task.excuse?.type ?? 'sem classificar o motivo';
      const cost = task.cost?.trim();
      const base = `Você escolheu ${excuse.toLowerCase()} em vez de ${goal.name.toLowerCase()}.`;
      return {
        goal,
        task,
        text: cost ? `${base} O custo foi ${cost}.` : `${base} O problema não foi tempo, foi prioridade.`,
      };
    })
    .slice(0, 3);
}

export const CLOSING_LINE = 'Amanhã o loop recomeça. Você já sabe o que corrigir.';

/* ────────────────────────────── Utilitários de leitura de dados ────────────────────────────── */

export function scoreOf(day: Day | undefined): number | null {
  if (!day?.score) return null;
  return day.score.total;
}

export function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function totalPlannedMinutes(items: ChecklistItem[]): number {
  return items.reduce((acc, i) => acc + parseDurationToMinutes(i.target), 0);
}

export function planSummary(items: ChecklistItem[]): string {
  const total = totalPlannedMinutes(items);
  if (!total) return 'Sem carga estimada';
  return `Carga prevista: ${formatMinutes(total)}`;
}

/** Zona de perigo: thresholds automáticos (regra 14). */
export interface DangerAlert {
  id: string;
  level: 'yellow' | 'red' | 'trend' | 'pattern';
  title: string;
  detail: string;
  action: string;
}

export function detectDanger(days: Day[], goals: Goal[], settings: Settings): DangerAlert[] {
  const alerts: DangerAlert[] = [];
  const closed = days.filter((d) => d.score).sort((a, b) => (a.date < b.date ? -1 : 1));
  const last = closed.slice(-3);

  const low = last.filter((d) => (d.score?.total ?? 10) < 5);
  if (low.length >= 2) {
    const worst = low[0];
    const areaTask = worst
      ? goals.find((g) => g.id === worst.tasks.find((t) => !t.done)?.goalId)
      : undefined;
    alerts.push({
      id: 'low-score',
      level: 'yellow',
      title: `Zona de Perigo: ${areaTask?.area ?? 'rotina'}`,
      detail: `${low.length} dos últimos 3 dias com score abaixo de 5.`,
      action: `Faça só o mínimo de ${areaTask?.name ?? 'uma meta prioritária'} — ${areaTask?.min ?? '10min'} — antes das 12h.`,
    });
  }

  const highUndone: string[] = [];
  for (const day of [...closed].reverse().slice(0, 5)) {
    const undone = priorityTasksUndone(day, goals);
    if (undone.length) highUndone.push(day.date);
    else break;
  }
  if (highUndone.length >= 3) {
    alerts.push({
      id: 'high-priority',
      level: 'red',
      title: 'Prioridade alta não cumprida',
      detail: `${highUndone.length} dias seguidos sem entregar prioridade alta (${highUndone
        .slice(0, 3)
        .map((d) => d.slice(8, 10) + '/' + d.slice(5, 7))
        .join(', ')}).`,
      action: 'Ativar Modo Recuperação e reduzir o checklist a 1 tarefa alta.',
    });
  }

  // Tendência: queda de 30%+ na consistência vs semana anterior.
  const thisWeek = closed.slice(-7).map((d) => d.score?.total ?? 0);
  const prevWeek = closed.slice(-14, -7).map((d) => d.score?.total ?? 0);
  const a = avg(thisWeek);
  const b = avg(prevWeek);
  if (a != null && b != null && b > 0 && (a - b) / b <= -0.3 && prevWeek.length >= 3) {
    alerts.push({
      id: 'trend',
      level: 'trend',
      title: 'Tendência de queda',
      detail: `Consistência caiu ${Math.round(((a - b) / b) * -100)}% vs semana anterior (${round1(b)} → ${round1(a)}).`,
      action: 'Reduzir para o modo mínimo por 2 dias e reavaliar.',
    });
  }

  // Padrão: mesma desculpa 3+ vezes nos últimos 7 dias.
  const excuseCount = new Map<string, number>();
  for (const d of closed.slice(-7)) {
    for (const t of d.tasks) {
      if (t.excuse?.type) excuseCount.set(t.excuse.type, (excuseCount.get(t.excuse.type) ?? 0) + 1);
    }
  }
  for (const [excuse, count] of excuseCount) {
    if (count >= 3) {
      alerts.push({
        id: `pattern-${excuse}`,
        level: 'pattern',
        title: `Padrão: ${excuse}`,
        detail: `"${excuse}" aparece ${count}x nos últimos 7 dias.`,
        action: 'Criar uma regra SE-ENTÃO específica para esse gatilho.',
      });
      break;
    }
  }

  void settings;
  return alerts;
}
