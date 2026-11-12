/**
 * Aplicar um plano do Copilot no app.
 *
 * O assistente NUNCA grava sozinho. Esta é a única porta de escrita: a tela
 * mostra o plano, a pessoa confere e toca em "Aplicar", e só então as ações do
 * store são chamadas (com toda a proteção que elas já têm: dia fechado, sanitize,
 * persistência).
 *
 * Regra que se mantém: nada é aplicado com valor inventado. Item sem dado
 * suficiente é contado em `skipped` e a tela diz por quê.
 */
import type { AppData, Goal } from './types';
import type { CopilotAction } from './copilot';
import { newId } from './id';
import { todayKey } from './date';
import type { StoreState } from './store';

export interface ApplyResult {
  /** O que foi gravado, em pt-BR, para a tela mostrar. */
  applied: string[];
  /** O que foi ignorado e o motivo (não pode virar silêncio). */
  skipped: string[];
  /**
   * Verdadeiro quando o plano precisou gravar a meta de água nas configurações
   * porque ela ainda não existia. A tela mostra isso como aviso — meta é
   * declaração da pessoa, e ninguém pode ser surpreendido por ela.
   */
  declared?: boolean;
}

type Store = Pick<
  StoreState,
  | 'goals'
  | 'days'
  | 'settings'
  | 'upsertGoal'
  | 'patchDiary'
  | 'addFinance'
  | 'ensureDay'
  | 'user'
  | 'updateSettings'
  | 'setScheduleOverride'
>;

/**
 * Gramática de meta: `min`/`ideal`/`excellent` são texto livre no app
 * ("15min", "3x", "1 capítulo"), então o plano entra direto nesse formato.
 */
function goalFromDraft(draft: { name: string; area: string; priority: 'high' | 'normal' | 'low'; min: string; ideal: string; excellent: string }): Goal {
  return {
    id: newId('goal'),
    name: draft.name,
    area: draft.area,
    priority: draft.priority,
    min: draft.min,
    ideal: draft.ideal,
    excellent: draft.excellent,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

/** Meta com nome já existente não é duplicada (o app teria duas linhas iguais). */
function alreadyExists(goals: Goal[], name: string): boolean {
  const key = name.trim().toLowerCase();
  return goals.some((g) => g.name.trim().toLowerCase() === key);
}

export function applyCopilot(action: CopilotAction, store: Store, today = todayKey()): ApplyResult {
  const applied: string[] = [];
  const skipped: string[] = [];

  switch (action.kind) {
    case 'goals': {
      for (const draft of action.items) {
        if (!draft.name.trim()) {
          skipped.push('Hábito sem nome — ignorado.');
          continue;
        }
        if (alreadyExists(store.goals, draft.name)) {
          skipped.push(`"${draft.name}" já existe como meta.`);
          continue;
        }
        const goal = goalFromDraft(draft);
        store.upsertGoal(goal);
        applied.push(`Meta "${draft.name}" (${draft.area})`);
        // Horário declarado vira AJUSTE da timeline (nunca registro de execução).
        if (draft.hour && /^\d{2}:\d{2}$/.test(draft.hour)) {
          store.setScheduleOverride(today, goal.id, draft.hour);
          applied.push(`Horário de "${draft.name}": ${draft.hour}`);
        }
      }
      break;
    }

    case 'workout': {
      const day = store.ensureDay(today);
      if (day.closedAt) {
        skipped.push('O dia está fechado — reabra para registrar treino.');
        break;
      }
      // Carga `null` fica `null`: a tela de Treino pede o valor.
      const exercises = action.workout.exercises.map((e) => ({
        name: e.name,
        restSec: e.restSec,
        sets: Array.from({ length: Math.max(1, e.sets) }, () => ({
          reps: Math.max(0, e.reps),
          weight: e.weight,
          done: false,
        })),
      }));
      store.patchDiary(today, {
        workout: { date: today, label: action.workout.label, exercises, kind: 'forca' },
      });
      applied.push(`Ficha "${action.workout.label}" (${exercises.length} exercícios)`);
      break;
    }

    case 'study': {
      const day = store.ensureDay(today);
      if (day.closedAt) {
        skipped.push('O dia está fechado — reabra para alterar o estudo.');
        break;
      }
      const current = (day.diary.studyPlan ?? { name: '', examDate: '', topics: [] }) as {
        name: string;
        examDate: string;
        topics: { id: string; subject: string; topic: string; status: 'novo' | 'estudado' | 'revisado' }[];
      };
      const topics = [...current.topics];
      let added = 0;
      for (const item of action.items) {
        for (const topic of item.topics) {
          const id = `${item.subject}-${topic}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (topics.some((t) => t.id === id)) continue;
          topics.push({ id, subject: item.subject, topic: topic.replace(/\s*—\s*\d+\s*min$/, ''), status: 'novo' });
          added += 1;
        }
      }
      if (!added) {
        skipped.push('Todos os tópicos já estavam no edital.');
        break;
      }
      store.patchDiary(today, {
        studyPlan: { ...current, name: current.name || action.planName, topics },
      });
      applied.push(`Edital: ${added} tópico(s) em ${action.items.length} matéria(s)`);
      break;
    }

    case 'finance': {
      let added = 0;
      for (const item of action.items) {
        if (item.amount == null || !Number.isFinite(item.amount) || item.amount <= 0) {
          skipped.push(`${item.category}: sem valor — não lancei nada.`);
          continue;
        }
        store.addFinance({
          id: newId('fin'),
          date: today,
          type: item.type,
          amount: item.amount,
          category: item.category,
          isImpulse: item.category === 'Impulso',
          note: 'via AI Copilot',
        });
        added += 1;
      }
      if (added) applied.push(`${added} lançamento(s) financeiros`);
      break;
    }

    case 'water': {
      const day = store.ensureDay(today);
      if (day.closedAt) {
        skipped.push('O dia está fechado — reabra para registrar água.');
        break;
      }
      const cups = Math.max(0, Math.min(40, Math.round(action.water.cups)));
      if (!cups) {
        skipped.push('Meta de água zerada — nada registrado.');
        break;
      }
      // Se a pessoa ainda não declarou meta de água, este plano VIRA a
      // declaração (é o que ela escreveu e confirmou). Fica marcado em
      // `declared` para a tela dizer de onde veio o número.
      let declared = false;
      if (store.settings?.waterGoalCups == null) {
        store.updateSettings({ waterGoalCups: cups });
        declared = true;
      }
      store.patchDiary(today, { waterCups: cups });
      applied.push(`Água: ${cups} copo(s) hoje`);
      return { applied, skipped, declared };
    }

    case 'schedule': {
      // A timeline do app é derivada das metas + modo do dia (`lib/schedule.ts`).
      // Um horário declarado entra como `scheduleOverrides` — o app trata isso
      // explicitamente como AJUSTE de sugestão, nunca como registro.
      const day = store.ensureDay(today);
      if (day.closedAt) {
        skipped.push('O dia está fechado — reabra para ajustar o cronograma.');
        break;
      }
      let count = 0;
      for (const item of action.items) {
        if (!/^\d{2}:\d{2}$/.test(item.hour)) {
          skipped.push(`${item.title}: horário ilegível, não entrou na timeline.`);
          continue;
        }
        store.setScheduleOverride(today, item.key, item.hour);
        count += 1;
      }
      if (count) applied.push(`${count} horário(s) ajustados na timeline`);
      break;
    }

    default:
      skipped.push('Ação sem aplicação direta.');
  }

  void (action as never);
  return { applied, skipped };
}

/**
 * O que o Copilot sabe sobre o dia — usado no "Aplicar" para não prometer o que
 * o app não pode fazer (dia fechado, sem meta, etc.).
 */
export function canWriteToday(data: AppData, today = todayKey()): boolean {
  const day = data.days.find((d) => d.date === today);
  return !day?.closedAt;
}
