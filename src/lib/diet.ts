/**
 * Dieta: registro de refeições do dia e leitura do que ele realmente mostra.
 *
 * Regra de honestidade: nada aqui estima caloria. A pessoa digita o que comeu e
 * marca se foi dentro do plano. "Sem dado" é diferente de "zero refeições" —
 * dia sem registro devolve `null`, não 0.
 *
 * O registro vive em `day.diary.food` (campo já existente no modelo), no formato
 * `MM:SS|Tipo|texto|ok|gatilho`, uma refeição por linha. Formato de texto simples
 * de propósito: sobrevive a backup/export sem migração de schema.
 */

import type { Day } from './types';

export type MealKind = 'Café' | 'Almoço' | 'Jantar' | 'Lanche' | 'Bebida';

export const MEAL_KINDS: MealKind[] = ['Café', 'Almoço', 'Jantar', 'Lanche', 'Bebida'];

/** O que estava por trás da refeição fora do plano. Nunca vira julgamento moral. */
export const MEAL_TRIGGERS = [
  'Fome real',
  'Ansiedade',
  'Tédio',
  'Social',
  'Cansaço',
  'Sem opção',
  'Nada — estava no plano',
] as const;

export interface Meal {
  /** `HH:MM`. */
  time: string;
  kind: MealKind;
  what: string;
  /** Dentro do plano? */
  onPlan: boolean;
  trigger: string;
}

const SEP = '|';

function asKind(value: string): MealKind {
  return (MEAL_KINDS as readonly string[]).includes(value) ? (value as MealKind) : 'Lanche';
}

/** Serializa a lista de volta para `diary.food`. */
export function serializeMeals(meals: Meal[]): string {
  return meals
    .map((m) => [m.time, m.kind, m.what.replace(/\|/g, '/'), m.onPlan ? '1' : '0', m.trigger].join(SEP))
    .join('\n');
}

/** Lê `diary.food`. Texto antigo (livre) vira uma refeição sem horário. */
export function parseMeals(food: string | undefined): Meal[] {
  const raw = (food ?? '').trim();
  if (!raw) return [];
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  const parsed: Meal[] = [];
  for (const line of lines) {
    const parts = line.split(SEP);
    if (parts.length >= 4 && /^\d{1,2}:\d{2}$/.test(parts[0].trim())) {
      parsed.push({
        time: parts[0].trim(),
        kind: asKind(parts[1].trim()),
        what: parts[2].trim(),
        onPlan: parts[3].trim() === '1',
        trigger: (parts[4] ?? '').trim(),
      });
    } else {
      // Registro antigo em texto livre: preservado, sem inventar horário.
      parsed.push({ time: '', kind: 'Lanche', what: line.trim(), onPlan: false, trigger: '' });
    }
  }
  return parsed;
}

export interface DayDiet {
  meals: Meal[];
  /** Total de refeições. */
  total: number;
  onPlan: number;
  offPlan: number;
  /** 0..1 — `null` sem nenhuma refeição (não é 0%). */
  planRatio: number | null;
  /** Gatilho mais frequente fora do plano. `null` sem registro. */
  topTrigger: { label: string; count: number } | null;
}

export function dayDiet(day: Day | undefined): DayDiet {
  const meals = parseMeals(day?.diary.food);
  const total = meals.length;
  const onPlan = meals.filter((m) => m.onPlan).length;
  const counts = new Map<string, number>();
  for (const m of meals.filter((x) => !x.onPlan)) {
    const label = m.trigger.trim();
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return {
    meals,
    total,
    onPlan,
    offPlan: total - onPlan,
    planRatio: total === 0 ? null : onPlan / total,
    topTrigger: top ? { label: top[0], count: top[1] } : null,
  };
}

export interface DietTrend {
  /** Dias com pelo menos uma refeição registrada. */
  loggedDays: number;
  /** Média de refeições fora do plano por dia registrado. `null` sem registro. */
  offPlanPerDay: number | null;
  /** Gatilho dominante na janela. */
  topTrigger: { label: string; count: number } | null;
  /** Série pronta para gráfico: um ponto por dia com registro. */
  series: { date: string; onPlan: number; offPlan: number }[];
}

/**
 * Tendência na janela de `days` (por data, não por posição no array).
 * Dias sem registro simplesmente não entram — não virei zero.
 */
export function dietTrend(days: Day[], windowDays = 14): DietTrend {
  const sorted = days.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const window = sorted.slice(-windowDays);
  const logged = window.filter((d) => parseMeals(d.diary.food).length > 0);
  const counts = new Map<string, number>();
  let offPlanTotal = 0;
  const series: { date: string; onPlan: number; offPlan: number }[] = [];
  for (const d of logged) {
    const info = dayDiet(d);
    offPlanTotal += info.offPlan;
    series.push({ date: d.date, onPlan: info.onPlan, offPlan: info.offPlan });
    for (const m of info.meals.filter((x) => !x.onPlan)) {
      const label = m.trigger.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
  return {
    loggedDays: logged.length,
    offPlanPerDay: logged.length === 0 ? null : offPlanTotal / logged.length,
    topTrigger: top ? { label: top[0], count: top[1] } : null,
    series,
  };
}

/** Refeições que ainda faltam hoje, pela hora atual. */
export function missingMeals(meals: Meal[], hour: number): MealKind[] {
  const done = new Set(meals.map((m) => m.kind));
  const expected: { kind: MealKind; until: number }[] = [
    { kind: 'Café', until: 10 },
    { kind: 'Almoço', until: 15 },
    { kind: 'Jantar', until: 22 },
  ];
  return expected.filter((e) => hour >= e.until && !done.has(e.kind)).map((e) => e.kind);
}

/** Hidratação: copos de 250 ml marcados no dia (campo `diary.waterCups`). */
export const WATER_CUP_ML = 250;

/**
 * Meta de água DECLARADA pela pessoa (`settings.waterGoalCups`).
 *
 * Não existe meta padrão. O app não calcula necessidade hídrica — depende de
 * peso, clima, treino e saúde, e fixar "8 copos" era uma afirmação inventada
 * (e contradizia o Copilot, que se recusa a chutar esse número). Sem declaração,
 * as telas mostram "Sem dado" e oferecem o campo no Perfil.
 */
export function waterGoalCups(settings: { waterGoalCups?: number } | undefined): number | null {
  const declared = settings?.waterGoalCups;
  if (typeof declared !== 'number' || !Number.isFinite(declared)) return null;
  if (declared < 1 || declared > 40) return null;
  return Math.round(declared);
}

/**
 * Progresso da hidratação.
 *
 * `cups == null` → `null` (sem registro, diferente de zero copo).
 * Meta não declarada → `null` também: não há como afirmar "50% da meta" sem meta.
 */
export function waterProgress(cups: number | undefined, goal: number | null): number | null {
  if (cups == null || goal == null || goal <= 0) return null;
  return Math.min(1.5, Math.max(0, cups) / goal);
}
