import { addDays, diffDays, todayKey } from './date';

/**
 * Cronograma do dia por área.
 *
 * O app não tem (e não deve inventar) agenda por tarefa: o dado que existe é
 * "essa tarefa dessa área já foi feita hoje?". O cronograma é DERIVADO disso —
 * um bloco por área ativa, com horário sugerido estável por data. Nada aqui é
 * dado fictício apresentado como registro: é sugestão, marcada como sugestão.
 */

export type SlotStatus = 'done' | 'open' | 'skipped';

export interface ScheduleSlot {
  /** Chave estável (`goalId`) — é o que a agenda nativa recebe. */
  key: string;
  area: string;
  title: string;
  start: string;
  end: string;
  status: SlotStatus;
  /** Prioridade alta: entra com alarme sugerido. */
  high: boolean;
}

const AREA_HOURS: Record<string, number> = {
  Treino: 6,
  Espiritualidade: 7,
  Estudo: 9,
  Trabalho: 9,
  Finanças: 12,
  Leitura: 20,
  Sono: 22,
  Saúde: 8,
  'Projeto Pessoal': 15,
  Relacionamentos: 19,
};

const BLOCK_MINUTES = 60;

/** Hora sugerida da área; sem mapa, deriva da data (estável, não aleatória). */
export function defaultHourFor(area: string, dateKey: string): number {
  if (AREA_HOURS[area] !== undefined) return AREA_HOURS[area]!;
  let hash = 0;
  const seed = `${area}|${dateKey}`;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) % 100003;
  // Dentro da janela útil do app (05:00–23:00).
  return 8 + (hash % 12);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function hourToHHmm(hour: number): string {
  return `${pad(Math.min(23, Math.max(0, hour)))}:00`;
}

export function parseHHmm(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  const hours = Number(h);
  const mins = Number(m);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return 0;
  return Math.min(23, Math.max(0, hours)) * 60 + Math.min(59, Math.max(0, mins));
}

/** Horário válido no formato 24h `HH:MM`. */
export function isHHmm(value: string | undefined): boolean {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return false;
  const [h, m] = value.split(':').map(Number);
  return (h ?? -1) >= 0 && (h ?? 99) <= 23 && (m ?? -1) >= 0 && (m ?? 99) <= 59;
}

export function addMinutes(hhmm: string, minutes: number): string {
  const total = parseHHmm(hhmm) + minutes;
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  return `${pad(h)}:${pad(m)}`;
}

export interface ScheduleInput {
  date: string;
  goals: { id: string; name: string; area: string; priority: string; min: string }[];
  tasks: { goalId: string; done: boolean }[];
  /** Dados reais de peso/refeição quando existirem: não inventar bloco que não existe. */
  skipAreas?: string[];
  /** Horários escolhidos pela pessoa (arrastar o bloco). Vence a sugestão. */
  overrides?: Record<string, string>;
}

/** Blocos do dia: uma meta por área (a de maior prioridade), já com status real. */
export function buildSchedule({ date, goals, tasks, skipAreas = [], overrides = {} }: ScheduleInput): ScheduleSlot[] {
  const doneByGoal = new Map(tasks.map((t) => [t.goalId, t.done]));
  const weight = (p: string) => (p === 'high' ? 0 : p === 'normal' ? 1 : 2);
  const byArea = new Map<string, ScheduleInput['goals'][number]>();
  for (const goal of goals) {
    if (skipAreas.includes(goal.area)) continue;
    const current = byArea.get(goal.area);
    if (!current || weight(goal.priority) < weight(current.priority)) byArea.set(goal.area, goal);
  }

  return [...byArea.values()]
    .map((goal) => {
      // Horário manual vence a sugestão por área; bloco arrastado continua sendo sugestão.
      const start = isHHmm(overrides[goal.id]) ? overrides[goal.id]! : hourToHHmm(defaultHourFor(goal.area, date));
      const done = doneByGoal.get(goal.id) ?? false;
      return {
        key: goal.id,
        area: goal.area,
        title: goal.name,
        start,
        end: addMinutes(start, BLOCK_MINUTES),
        status: (done ? 'done' : 'open') as SlotStatus,
        high: goal.priority === 'high',
      };
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

/**
 * Próximo bloco em aberto a partir de agora.
 *
 * Se o dia já passou de todos os horários, devolve o último em aberto (o que
 * ainda dá para fazer hoje) — nunca um bloco às 9h quando são 21h.
 */
export function nextSlot(slots: ScheduleSlot[], now: string): ScheduleSlot | undefined {
  const open = slots.filter((s) => s.status === 'open');
  const ahead = open.find((s) => s.start >= now);
  if (ahead) return ahead;
  return [...open].reverse()[0];
}

/** Blocos de hoje que ainda não foram registrados: é o que vai para a agenda. */
export function slotsToSync(slots: ScheduleSlot[]): ScheduleSlot[] {
  return slots.filter((s) => s.status === 'open');
}

/** Progresso de uma área hoje, contando só tarefas daquela área. */
export function areaProgress(
  goals: { id: string; area: string; name: string }[],
  tasks: { goalId: string; done: boolean }[],
  area: string,
): { total: number; done: number; headline: string } {
  const ids = new Set(goals.filter((g) => g.area === area).map((g) => g.id));
  const mine = tasks.filter((t) => ids.has(t.goalId));
  const done = mine.filter((t) => t.done).length;
  return {
    total: mine.length,
    done,
    headline: mine.length ? `${done}/${mine.length} feitas` : 'Sem dado',
  };
}

/** Rótulo curto do que a área entrega hoje (usa a meta de maior prioridade). */
export function areaHeadline(goals: { area: string; name: string; min: string; priority: string }[], area: string): string {
  const mine = goals
    .filter((g) => g.area === area)
    .sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0));
  if (!mine.length) return 'Sem dado';
  return mine[0]!.name;
}

/** Texto do contador de dias até uma data (prazo de projeto). */
export function deadlineLabel(deadline: string, today = todayKey()): string {
  // diffDays(a, b) = a - b; aqui queremos "quantos dias faltam até o prazo".
  const diff = diffDays(deadline, today);
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'amanhã';
  if (diff < 0) return `${Math.abs(diff)}d atrás`;
  return `${diff}d restantes`;
}

export { addDays };
