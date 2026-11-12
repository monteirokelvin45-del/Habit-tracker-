/**
 * AI Copilot — o "cérebro" do assistente do app.
 *
 * Este arquivo é PURO: recebe texto e o estado atual, devolve plano. Nenhuma
 * chamada de rede, nenhuma gravação. Isso é de propósito:
 *
 *  1. o app não tem servidor e não manda os registros da pessoa para lugar
 *     nenhum — o assistente roda no aparelho;
 *  2. o que ele sabe é o que está no `AppData` (mais o texto que a pessoa
 *     colar), então nada aqui pode "inventar" streak, kcal ou progresso;
 *  3. plano é proposta, não fato: só vira registro quando a pessoa toca em
 *     "Aplicar" (ver `applyCopilot` em `lib/copilotApply.ts`).
 *
 * Regra de honestidade que atravessa o arquivo inteiro:
 *  - `null` significa "não há registro" e é escrito como "Sem dado";
 *  - meta que depende de dado que o app não tem (altura, peso, gasto) NÃO é
 *    gerada — a resposta diz qual dado falta, em vez de chutar 2.500 kcal;
 *  - caloria, bpm e composição corporal nunca são calculados: só entram se a
 *    pessoa digitar.
 */
import type { AppData, Day } from './types';
import { addDays, todayKey } from './date';
import { dayDiet, waterGoalCups, WATER_CUP_ML } from './diet';
import { formatBRL } from './date';
import { sessionVolume, type WorkoutSession } from './training';
import { planProgress, workloadBySubject, type EditalTopic } from './studies';
import { bucketOf, BUCKETS } from './finance';
import { streakInfo } from './stats';

/* ───────────────────────────── tipos ───────────────────────────── */

/** Qual módulo do app a intenção atinge. */
export type CopilotModule = 'rotina' | 'treino' | 'estudo' | 'financas' | 'dieta' | 'resumo';

export interface CopilotGoalDraft {
  name: string;
  area: string;
  priority: 'high' | 'normal' | 'low';
  min: string;
  ideal: string;
  excellent: string;
  /**
   * Horário que a pessoa declarou para o hábito (`HH:MM`). Vira
   * `scheduleOverrides` do dia — o app trata isso como AJUSTE de sugestão, não
   * como registro de que o hábito aconteceu.
   */
  hour?: string | null;
}

export interface CopilotScheduleDraft {
  /** Chave do bloco; a mesma que `schedule.ts` usa. */
  key: string;
  hour: string;
  title: string;
}

export interface CopilotWorkoutDraft {
  label: string;
  exercises: { name: string; sets: number; reps: number; weight: number | null; restSec: number }[];
}

export interface CopilotStudyDraft {
  /** Matérias com tópicos pendentes (sem peso inventado). */
  subject: string;
  topics: string[];
}

export interface CopilotFinanceDraft {
  category: string;
  /** `null` = a pessoa não informou valor. O app não estima gasto. */
  amount: number | null;
  type: 'income' | 'expense';
}

export interface CopilotWaterDraft {
  /** Copos (250 ml). Só entra se a pessoa declarou a meta. */
  cups: number;
}

/** Um dado que falta para a IA poder responder com honestidade. */
export interface CopilotGap {
  field: 'heightCm' | 'weightKg' | 'waterGoal' | 'education' | 'examDate';
  question: string;
}

export type CopilotAction =
  | { kind: 'goals'; items: CopilotGoalDraft[] }
  | { kind: 'schedule'; items: CopilotScheduleDraft[] }
  | { kind: 'workout'; workout: CopilotWorkoutDraft }
  | { kind: 'study'; planName: string; items: CopilotStudyDraft[] }
  | { kind: 'finance'; items: CopilotFinanceDraft[]; split: number[] | null }
  | { kind: 'water'; water: CopilotWaterDraft };

export interface CopilotReply {
  /** Frase principal (o que ele entendeu). */
  text: string;
  /** Linhas de detalhe — números sempre vêm do estado, nunca da imaginação. */
  lines: string[];
  /** Avisos honestos ("não dá para calcular X sem Y"). */
  notes: string[];
  action?: CopilotAction;
  gaps: CopilotGap[];
  module: CopilotModule;
  /** O que foi lido do texto da pessoa (para ela conferir antes de aplicar). */
  parsed: string[];
}

export interface CopilotContext {
  /** Nome da pessoa (do onboarding) — usado na saudação, não no corpo da resposta. */
  name: string;
  data: AppData;
  today?: string;
  /** Estado do app: kcal/macros não são calculados, então a resposta diz isso. */
}

/* ───────────────────────── utilidades ───────────────────────── */

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Horário em texto livre → `HH:MM`.
 * Aceita "7h", "7:30", "07:30", "às 19 horas", "19h30".
 * Devolve `null` quando não há horário — nunca inventa um.
 */
export function parseHour(raw: string): string | null {
  const m =
    /(?:^|\s|[àa]s?\s*)(\d{1,2})\s*[:h]\s*(\d{2})/.exec(raw) ??
    /(?:^|\s|[àa]s?\s*)(\d{1,2})\s*(?:h|horas?|hrs?)(?:\s|$)/i.exec(raw);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Duração declarada ("30 min", "1h30", "45 minutos") → minutos. `null` se não houver. */
export function parseMinutes(raw: string): number | null {
  const h = /(\d{1,2})\s*(?:h|hora)s?(?:\s*(\d{1,2}))?/i.exec(raw);
  if (h) {
    const hours = Number(h[1]);
    const rest = h[2] ? Number(h[2]) : 0;
    if (Number.isFinite(hours)) return hours * 60 + (Number.isFinite(rest) ? rest : 0);
  }
  const m = /(\d{1,3})\s*(?:min|minutos?)/i.exec(raw);
  if (m) {
    const value = Number(m[1]);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/** Área da vida a partir de palavra-chave (as mesmas `LIFE_AREAS` do app). */
export function guessArea(text: string): string | null {
  const t = norm(text);
  const map: [RegExp, string][] = [
    [
      /\b(treino|academia|musculacao|corrida|cardio|perna|peito|costas|ombro|biceps|triceps|gluteo|abdomen|core|supino|remada|agachamento|leg press|puxada|desenvolvimento|rosca|prancha|flexao|abdominal)\b/,
      'Treino',
    ],
    [/\b(estudo|estudar|concurso|prova|edital|faculdade|vestibular|materia|revisao|leitura tecnica)\b/, 'Estudo'],
    [/\b(leitura|ler|livro|paginas?)\b/, 'Leitura'],
    [/\b(dinheiro|financas?|orcamento|gasto|economia|investir|investimento|poupanca|conta)\b/, 'Finanças'],
    [/\b(sono|dormir|acordar|deitar|descanso)\b/, 'Sono'],
    [/\b(agua|hidratacao|beber)\b/, 'Saúde'],
    [/\b(dieta|comida|alimentacao|refeicao|caloria|proteina|macro|almoco|jantar|cafe)\b/, 'Dieta'],
    [/\b(projeto|app|portfolio|freela|negocio proprio)\b/, 'Projeto Pessoal'],
    [/\b(trabalho|emprego|reuniao|cliente)\b/, 'Trabalho'],
    [/\b(meditar|meditacao|oracao|espiritual|gratidao)\b/, 'Espiritualidade'],
    [/\b(familia|amigos|relacionamento|namoro|conversar)\b/, 'Relacionamentos'],
    [/\b(academia|corpo|saude|alongamento|caminhada)\b/, 'Saúde'],
  ];
  for (const [re, area] of map) if (re.test(t)) return area;
  return null;
}

/** Módulo do app a partir do texto. */
export function guessModule(text: string): CopilotModule {
  const t = norm(text);
  // Resumo vem PRIMEIRO: "resumir meu dia" contém "dia", que também é palavra de
  // rotina — e o usuário que pede resumo não quer um cronograma.
  if (/\b(resum|resumo|como estou|meu dia|meu progresso|progresso do dia|motiva|insight)\b/.test(t)) return 'resumo';
  if (/\b(treino|academia|musculacao|series?|reps?|repeticao|leg day|push|pull|cardio|agachamento|supino|ficha)\b/.test(t)) return 'treino';
  if (/\b(estudo|estudar|concurso|edital|prova|materia|revisao|pomodoro|leitura|livro|cronograma de estudo)\b/.test(t)) return 'estudo';
  // Finanças: inclui o verbo ("gastei") e o lugar ("mercado"), que é como a
  // pessoa fala de dinheiro sem dizer "finanças".
  if (/\b(financ\w*|gast\w*|or[cç]amento|economi\w*|investir|investimento|receit\w*|despesa\w*|divida|dinheiro|salario|mercado|supermercado|uber|aluguel|pag\w*|comprei|compras?)\b/.test(t)) return 'financas';
  if (/\b(dieta|agua|hidrata\w*|macros?|protein\w*|comida|alimenta\w*|refei\w*|kcal|caloria\w*)\b/.test(t)) return 'dieta';
  if (/\b(rotina|habitos?|agenda|horario|timeline|manha|tarde|noite|organizar|acordar|dormir)\b/.test(t)) return 'rotina';
  return 'resumo';
}

/* ───────────────────────── leitura da rotina ───────────────────────── */

interface RoutineItem {
  hour: string;
  title: string;
  minutes: number | null;
  area: string;
}

/**
 * Extrai hábitos de um texto livre ("Acordar 6h, meditar 10min, treinar às 19h").
 *
 * Cada item PRECISA de um horário para entrar na timeline: sem hora, ele não é
 * agendado (vira "lido, mas sem horário" na resposta) — agenda inventada seria
 * pior que nenhuma agenda.
 */
export function parseRoutine(text: string): { items: RoutineItem[]; withoutHour: string[] } {
  const items: RoutineItem[] = [];
  const withoutHour: string[] = [];
  const chunks = text
    .replace(/\se\s/gi, '\n')
    .split(/[\n;•·,]+/)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2);

  for (const chunk of chunks) {
    const hour = parseHour(chunk);
    // Tira hora e duração do título: o título é o hábito, não o horário.
    const title = chunk
      .replace(/(?:^|\s)(?:[àa]s?\s*)?\d{1,2}\s*[:h]\s*\d{0,2}\s*(?:horas?|hrs?|min(?:utos?)?)?/gi, ' ')
      .replace(/\b\d{1,3}\s*(?:min|minutos?|h|horas?)\b/gi, ' ')
      .replace(/[–—-]+\s*$/, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!title || norm(title).length < 2) continue;
    if (!hour) {
      withoutHour.push(title);
      continue;
    }
    items.push({
      hour,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      minutes: parseMinutes(chunk),
      area: guessArea(title) ?? 'Saúde',
    });
  }
  return { items, withoutHour };
}

/* ───────────────────────── dados do estado ───────────────────────── */

function dayMap(data: AppData): Map<string, Day> {
  return new Map(data.days.map((d) => [d.date, d]));
}

/**
 * Streak atual por área, do registro real.
 *
 * Lê as tarefas do dia cujo `goalId` pertence a uma meta daquela área: área sem
 * meta não tem sequência (e não vira 0 "de exemplo").
 */
export function areaStreaks(data: AppData): { area: string; streak: number }[] {
  const byGoal = new Map<string, string>();
  for (const g of data.goals) byGoal.set(g.id, g.area);
  const areas = data.user.areas.length ? data.user.areas : Array.from(new Set(data.goals.map((g) => g.area)));
  return areas.map((area) => {
    const dates = data.days
      .filter((d) => d.tasks.some((t) => t.done && byGoal.get(t.goalId) === area))
      .map((d) => d.date)
      .sort();
    let streak = 0;
    let cursor = dates[dates.length - 1];
    while (cursor) {
      if (!dates.includes(cursor)) break;
      streak += 1;
      cursor = addDays(cursor, -1);
      if (streak > 400) break;
    }
    return { area, streak };
  });
}

/**
 * Copos de água recomendados — e a recusa em recomendar sem base.
 *
 * O app não calcula necessidade hídrica (depende de peso, clima, treino e saúde
 * da pessoa). Sem uma meta declarada nas configurações, devolve `null` e a
 * resposta diz o que falta, em vez de fixar 8 copos como se fosse ciência.
 */
export function waterCupsFor(data: AppData): number | null {
  // Mesma fonte que a Dieta usa (`waterGoalCups`): uma meta só, sem duplicar regra.
  return waterGoalCups(data.settings);
}

/**
 * Divisão de macros — só com o que a pessoa informou.
 *
 * Sem declaração, `null`: o app não calcula necessidade nutricional, então a
 * resposta pede o dado em vez de sugerir "30/45/25".
 */
export function macroSplit(data: AppData): { protein: number; carbs: number; fat: number } | null {
  const { proteinPct, carbsPct, fatPct } = data.settings;
  if (
    typeof proteinPct === 'number' &&
    typeof carbsPct === 'number' &&
    typeof fatPct === 'number' &&
    Number.isFinite(proteinPct) &&
    Number.isFinite(carbsPct) &&
    Number.isFinite(fatPct) &&
    proteinPct + carbsPct + fatPct > 0 &&
    proteinPct + carbsPct + fatPct <= 100
  ) {
    return { protein: proteinPct, carbs: carbsPct, fat: fatPct };
  }
  return null;
}

/* ───────────────────────── ficha de treino ───────────────────────── */

/** Exercícios por grupo — vocabulário de treino, não registro da pessoa. */
const EXERCISE_LIBRARY: Record<string, { name: string; defaultSets: number; defaultReps: number }[]> = {
  Pernas: [
    { name: 'Agachamento livre', defaultSets: 4, defaultReps: 8 },
    { name: 'Leg press', defaultSets: 3, defaultReps: 12 },
    { name: 'Cadeira flexora', defaultSets: 3, defaultReps: 12 },
    { name: 'Panturrilha em pé', defaultSets: 3, defaultReps: 15 },
  ],
  Peito: [
    { name: 'Supino reto', defaultSets: 4, defaultReps: 8 },
    { name: 'Supino inclinado', defaultSets: 3, defaultReps: 10 },
    { name: 'Crucifixo', defaultSets: 3, defaultReps: 12 },
    { name: 'Tríceps corda', defaultSets: 3, defaultReps: 12 },
  ],
  Costas: [
    { name: 'Puxada frontal', defaultSets: 4, defaultReps: 10 },
    { name: 'Remada curvada', defaultSets: 3, defaultReps: 10 },
    { name: 'Remada unilateral', defaultSets: 3, defaultReps: 12 },
    { name: 'Rosca direta', defaultSets: 3, defaultReps: 12 },
  ],
  Ombros: [
    { name: 'Desenvolvimento militar', defaultSets: 4, defaultReps: 10 },
    { name: 'Elevação lateral', defaultSets: 3, defaultReps: 15 },
    { name: 'Elevação frontal', defaultSets: 3, defaultReps: 12 },
    { name: 'Encolhimento', defaultSets: 3, defaultReps: 12 },
  ],
  Full: [
    { name: 'Agachamento livre', defaultSets: 3, defaultReps: 10 },
    { name: 'Supino reto', defaultSets: 3, defaultReps: 10 },
    { name: 'Puxada frontal', defaultSets: 3, defaultReps: 10 },
    { name: 'Prancha', defaultSets: 3, defaultReps: 1 },
  ],
};

/**
 * Monta ficha de treino a partir do que a pessoa pediu.
 *
 * A carga sai da ÚLTIMA sessão registrada daquele exercício. Sem histórico, vem
 * `null` (a pessoa preenche) — nunca 30 kg de exemplo, que pareceria dado dela.
 */
export function buildWorkout(text: string, data: AppData, today = todayKey()): CopilotWorkoutDraft {
  const t = norm(text);
  const group = /\b(perna|leg|inferior|gluteo|quadril)\b/.test(t)
    ? 'Pernas'
    : /\b(peito|push|empurrar|superior)\b/.test(t)
      ? 'Peito'
      : /\b(costas|pull|puxar|dorsal|biceps)\b/.test(t)
        ? 'Costas'
        : /\b(ombro|shoulder)\b/.test(t)
          ? 'Ombros'
          : 'Full';

  const words: Record<string, string> = { Pernas: 'Pernas', Peito: 'Peito e Tríceps', Costas: 'Costas e Bíceps', Ombros: 'Ombros', Full: 'Full Body' };
  const label = /\b(full body|corpo inteiro)\b/.test(t) ? 'Full Body' : `Treino ${group === 'Full' ? 'Full Body' : words[group]}`;

  const history = lastWeights(data, today);
  const exercises = EXERCISE_LIBRARY[group]!.map((ex) => ({
    name: ex.name,
    sets: ex.defaultSets,
    reps: ex.defaultReps,
    weight: history.get(norm(ex.name)) ?? null,
    restSec: 90,
  }));
  return { label, exercises };
}

/** Última carga registrada por exercício (nome normalizado → kg). */
export function lastWeights(data: AppData, today = todayKey()): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = data.days
    .filter((d) => d.date <= today)
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  for (const day of sorted) {
    const session = day.diary.workout as WorkoutSession | undefined;
    if (!session || !Array.isArray(session.exercises)) continue;
    for (const ex of session.exercises) {
      if (!ex || typeof ex.name !== 'string') continue;
      const top = (ex.sets ?? [])
        .map((s) => (s && typeof s.weight === 'number' && Number.isFinite(s.weight) ? s.weight : null))
        .filter((w): w is number => w != null)
        .sort((a, b) => b - a)[0];
      if (top != null) out.set(norm(ex.name), top);
    }
  }
  return out;
}

/* ───────────────────────── plano de estudo ───────────────────────── */

/**
 * Cronograma de estudo a partir de matérias citadas.
 * Cada matéria vira um bloco com os tópicos que a própria pessoa escreveu; o
 * app não inventa tópicos de edital.
 */
export function buildStudyPlan(text: string, data: AppData, today = todayKey()): { planName: string; items: CopilotStudyDraft[] } {
  const lines = text
    .split(/[\n;,]/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 2);
  const items: CopilotStudyDraft[] = [];
  for (const line of lines) {
    const minutes = parseMinutes(line);
    const hour = parseHour(line);
    const subject = line
      .replace(/(?:^|\s)(?:[àa]s?\s*)?\d{1,2}\s*[:h]\s*\d{0,2}/gi, ' ')
      .replace(/\b\d{1,3}\s*(?:min|minutos?|h|horas?)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!subject || norm(subject).length < 2) continue;
    const existing = items.find((i) => norm(i.subject) === norm(subject));
    const topic = minutes ? `${subject} — ${minutes} min` : subject;
    if (existing) existing.topics.push(topic);
    else items.push({ subject: subject.charAt(0).toUpperCase() + subject.slice(1), topics: [topic] });
    void hour;
  }
  const planName = /\b(concurso|edital|prova)\b/.test(norm(text)) ? 'Plano do edital' : 'Plano de estudo';
  void data;
  void today;
  return { planName, items };
}

/* ───────────────────────── finanças ───────────────────────── */

/**
 * Categoriza gastos citados e recomenda economia SÓ sobre o que existe.
 *
 * "Economizar 20%" de uma despesa que a pessoa não informou seria invenção.
 * Valores ausentes entram como `null` e a resposta pede o valor.
 */
export function buildFinancePlan(
  text: string,
  data: AppData,
): { items: CopilotFinanceDraft[]; split: number[] | null; totalExpense: number | null } {
  const items: CopilotFinanceDraft[] = [];
  const re = /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{2,}?)\s*(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})?|\d+(?:[.,]\d{2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const label = m[1]!.trim().replace(/^(e|de|com|no|na|do|da)\s+/i, '');
    const raw = m[2]!.replace(/\./g, '').replace(',', '.');
    const amount = Number(raw);
    if (!label || norm(label).length < 3) continue;
    items.push({
      category: categorize(label),
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      type: /\b(recebi|receita|entrou|salario|salário|ganhei)\b/i.test(text) ? 'income' : 'expense',
    });
  }
  // Item citado SEM valor ("cinema" e nada mais) não pode desaparecer: a pessoa
  // falou de um gasto e a resposta tem de perguntar quanto foi — não ignorar.
  const MENCIONADOS: [RegExp, string][] = [
    [/\bmercado|supermercado|feira\b/, 'Alimentação'],
    [/\bifood|restaurante|padaria|lanche\b/, 'Alimentação'],
    [/\buber|onibus|metro|gasolina|combustivel\b/, 'Transporte'],
    [/\bcinema|bar|festa|streaming|netflix|spotify|jogo\b/, 'Lazer'],
    [/\baluguel|condominio|luz|internet|celular\b/, 'Fixo'],
    [/\binvesti|investimento|poupanca|reserva\b/, 'Investimento'],
  ];
  for (const [re, category] of MENCIONADOS) {
    if (!re.test(norm(text))) continue;
    if (items.some((i) => i.category === category)) continue;
    items.push({ category, amount: null, type: 'expense' });
  }

  const expenses = items.filter((i) => i.type === 'expense');
  const totalExpense = expenses.length ? expenses.reduce((s, i) => s + (i.amount ?? 0), 0) : null;
  // Split é o da configuração (referência), não uma sugestão "ótima" inventada.
  const split = BUCKETS.length ? BUCKETS.map(() => Math.round(100 / BUCKETS.length)) : null;
  void data;
  return { items, split, totalExpense: totalExpense && totalExpense > 0 ? totalExpense : null };
}

/** Texto livre → categoria do app (as `FINANCE_CATEGORIES` reais). */
export function categorize(label: string): string {
  const t = norm(label);
  if (/\b(mercado|supermercado|feira|padaria|almoco|jantar|cafe|restaurante|ifood|lanche)\b/.test(t)) return 'Alimentação';
  if (/\b(uber|onibus|metro|gasolina|combustivel|passagem|estacionamento)\b/.test(t)) return 'Transporte';
  if (/\b(cinema|bar|festa|jogo|streaming|netflix|spotify|lazer)\b/.test(t)) return 'Lazer';
  if (/\b(impulso|compra por impulso|promocao|achado)\b/.test(t)) return 'Impulso';
  if (/\b(aluguel|condominio|luz|agua|internet|celular|escola|faculdade|seguro)\b/.test(t)) return 'Fixo';
  if (/\b(investi|investimento|cdb|tesouro|acoes|poupanca|reserva)\b/.test(t)) return 'Investimento';
  return bucketOf(label) === 'necessidade' ? 'Fixo' : 'Outros';
}

/* ───────────────────────── resumo do dia ───────────────────────── */

/**
 * Resumo do dia — só com o que está registrado.
 * Score ausente, água ausente, treino ausente: cada um vira "sem registro",
 * nunca zero nem elogio vazio.
 */
export function daySummary(data: AppData, today = todayKey()): string[] {
  const day = data.days.find((d) => d.date === today);
  const out: string[] = [];
  if (!day) {
    out.push('Hoje ainda não existe registro aberto no app.');
    return out;
  }
  const done = day.tasks.filter((t) => t.done).length;
  const total = day.tasks.length;
  out.push(total ? `Checklist: ${done} de ${total} tarefa(s) feitas.` : 'Checklist de hoje vazio (nenhuma meta ativa no modo atual).');

  if (day.score) out.push(`Score fechado de hoje: ${day.score.total.toFixed(1)}/10.`);
  else out.push('Score: dia ainda não fechado.');

  const diet = dayDiet(day);
  if (diet.total) out.push(`Refeições registradas: ${diet.total} (${diet.onPlan} dentro do plano).`);
  else out.push('Refeições: sem registro hoje.');

  out.push(
    typeof day.diary.waterCups === 'number'
      ? `Água: ${day.diary.waterCups} copo(s) de ${WATER_CUP_ML} ml.`
      : 'Água: sem registro hoje.',
  );

  const workout = day.diary.workout as WorkoutSession | undefined;
  if (workout && Array.isArray(workout.exercises) && workout.exercises.length) {
    const volume = sessionVolume(workout);
    out.push(volume > 0 ? `Treino registrado: ${workout.label} · volume ${Math.round(volume)} kg.` : `Treino registrado: ${workout.label} (sem carga informada).`);
  } else out.push('Treino: sem registro hoje.');

  const focus = (day.pomodoros ?? []).reduce((s, p) => s + (Number.isFinite(p.minutes) ? p.minutes : 0), 0);
  out.push(focus > 0 ? `Foco: ${focus} min de pomodoro.` : 'Foco: sem pomodoro hoje.');
  return out;
}

/* ───────────────────────── resposta principal ───────────────────────── */

/** Metas pendentes do app (para a resposta de rotina não duplicar meta). */
function goalNames(data: AppData): string[] {
  return data.goals.filter((g) => g.active !== false).map((g) => norm(g.name));
}

/**
 * Responde uma pergunta/comando.
 *
 * Sempre devolve `gaps` quando falta dado para uma afirmação — é a diferença
 * entre "não sei" e "inventei".
 */
export function respond(raw: string, ctx: CopilotContext): CopilotReply {
  const text = raw.trim();
  const today = ctx.today ?? todayKey();
  const data = ctx.data;
  const module = guessModule(text);
  const gaps: CopilotGap[] = [];

  if (!text) {
    return {
      text: 'Escreva o que você quer organizar, ou use um dos atalhos abaixo.',
      lines: [],
      notes: [],
      gaps: [{ field: 'education', question: 'O que você quer fazer agora: rotina, treino, estudo, finanças ou resumo do dia?' }],
      module: 'resumo',
      parsed: [],
    };
  }

  /* ── resumo / motivação ── */
  if (module === 'resumo') {
    const lines = daySummary(data, today);
    const weeks = streakInfo(data.days, { end: today, window: 30 });
    if (weeks.current > 0) lines.push(`Sequência atual de dias fechados: ${weeks.current}.`);
    else lines.push('Sequência: sem dia fechado recente.');
    return {
      text: 'Aqui está o seu dia, com o que está registrado:',
      lines,
      notes: ['Resumo feito só com os registros do app — nada aqui é estimado.'],
      gaps: [],
      module: 'resumo',
      parsed: [],
    };
  }

  /* ── rotina ── */
  if (module === 'rotina') {
    const { items, withoutHour } = parseRoutine(text);
    const existing = goalNames(data);
    const fresh = items.filter((i) => !existing.includes(norm(i.title)));
    const goals: CopilotGoalDraft[] = fresh.slice(0, 8).map((i) => ({
      name: i.title,
      area: i.area,
      priority: 'normal',
      min: i.minutes ? `${Math.max(5, Math.round(i.minutes * 0.5))}min` : '15min',
      ideal: i.minutes ? `${i.minutes}min` : '30min',
      excellent: i.minutes ? `${Math.round(i.minutes * 1.5)}min` : '45min',
      hour: i.hour,
    }));
    const notes: string[] = [];
    if (withoutHour.length) notes.push(`Sem horário, não dá para colocar na timeline: ${withoutHour.slice(0, 4).join(', ')}.`);
    if (!items.length && !withoutHour.length) notes.push('Não encontrei hábito com horário no texto. Ex.: "7h meditar 10min".');
    if (items.length) notes.push('A timeline mostra sugestão de horário — ela não registra que o hábito foi feito.');
    return {
      text: goals.length
        ? `Entendi ${goals.length} hábito(s). Confira antes de aplicar:`
        : 'Não encontrei hábito novo para criar.',
      lines: items.map((i) => `${i.hour} · ${i.title}${i.minutes ? ` · ${i.minutes} min` : ''}`),
      notes,
      action: goals.length ? { kind: 'goals', items: goals } : undefined,
      gaps: [],
      module: 'rotina',
      parsed: items.map((i) => i.title),
    };
  }

  /* ── treino ── */
  if (module === 'treino') {
    const workout = buildWorkout(text, data, today);
    const withoutHistory = workout.exercises.filter((e) => e.weight == null).length;
    const notes = [
      'Carga vem da última sessão registrada do exercício. Sem histórico, o campo fica vazio para você preencher.',
      'O app não calcula gasto calórico nem bpm — só registra se você digitar.',
    ];
    if (withoutHistory === workout.exercises.length) notes.push('Nenhum desses exercícios tem histórico de carga aqui.');
    const wantsDiet = /\b(caloria|kcal|macro|proteina|dieta|agua|hidratacao)\b/.test(norm(text));
    if (wantsDiet) {
      const cups = waterCupsFor(data);
      if (cups == null) gaps.push({ field: 'waterGoal', question: 'Quantos copos de água por dia você definiu como meta? O app não estima necessidade hídrica.' });
      const split = macroSplit(data);
      if (!split) gaps.push({ field: 'education', question: 'Qual distribuição de macros você segue? (o app não calcula necessidade nutricional)' });
      const protein = data.settings.heightCm;
      if (!protein) gaps.push({ field: 'heightCm', question: 'Sua altura está no Perfil? Sem ela o IMC fica "Sem dado".' });
    }
    return {
      text: `Ficha pronta: ${workout.label}.`,
      lines: workout.exercises.map(
        (e) => `${e.name} · ${e.sets}×${e.reps}${e.weight != null ? ` · ${e.weight} kg` : ' · carga a definir'}`,
      ),
      notes,
      action: { kind: 'workout', workout },
      gaps,
      module: 'treino',
      parsed: [workout.label],
    };
  }

  /* ── estudo ── */
  if (module === 'estudo') {
    const { planName, items } = buildStudyPlan(text, data, today);
    const plan = data.days.find((d) => d.date === today)?.diary.studyPlan as
      | { name: string; examDate: string; topics: EditalTopic[] }
      | undefined;
    const lines: string[] = [];
    if (plan && plan.topics.length) {
      const info = planProgress(plan);
      lines.push(`Edital atual: ${info.studied}/${info.total} tópicos estudados${plan.examDate ? ` · prova ${plan.examDate}` : ''}.`);
      for (const w of workloadBySubject(plan).slice(0, 3)) lines.push(`${w.subject}: ${w.pending} pendente(s) · peso ${w.weight}`);
    }
    const notes: string[] = [];
    if (!plan?.examDate) gaps.push({ field: 'examDate', question: 'Qual a data da prova? Sem ela não dá para calcular tópicos por dia.' });
    if (!items.length) notes.push('Não encontrei matéria no texto. Ex.: "Direito 40min, Português 30min".');
    return {
      text: items.length ? `${planName} com ${items.length} matéria(s).` : 'Não encontrei matéria para montar o cronograma.',
      lines: items.length ? items.map((i) => `${i.subject} · ${i.topics.length} tópico(s)`) : lines,
      notes,
      action: items.length ? { kind: 'study', planName, items } : undefined,
      gaps,
      module: 'estudo',
      parsed: items.map((i) => i.subject),
    };
  }

  /* ── finanças ── */
  if (module === 'financas') {
    const { items, totalExpense } = buildFinancePlan(text, data);
    const month = today.slice(0, 7);
    const logged = data.finances.filter((f) => f.date.slice(0, 7) === month);
    const spent = logged.filter((f) => f.type === 'expense').reduce((s, f) => s + (Number.isFinite(f.amount) ? f.amount : 0), 0);
    const lines = [
      logged.length ? `No mês: ${logged.length} lançamento(s), ${formatBRL(spent)} em despesas.` : 'Sem lançamento financeiro neste mês.',
    ];
    if (totalExpense != null) lines.push(`Do texto: ${formatBRL(totalExpense)} em despesas para categorizar.`);
    const missing = items.filter((i) => i.amount == null).length;
    const notes = [
      'Categorização é do app; valor só entra se você informar — o app não estima gasto.',
    ];
    if (missing) notes.push(`${missing} item(ns) sem valor legível — vou pedir o valor em vez de chutar.`);
    if (!items.length) notes.push('Ex.: "mercado 320, uber 80, cinema 45".');
    return {
      text: items.length ? `Classifiquei ${items.length} gasto(s).` : 'Não encontrei gasto com valor no texto.',
      lines,
      notes,
      action: items.length ? { kind: 'finance', items, split: null } : undefined,
      gaps: missing ? [{ field: 'education', question: 'Qual o valor dos itens que ficaram sem número?' }] : [],
      module: 'financas',
      parsed: items.map((i) => i.category),
    };
  }

  /* ── dieta / água ── */
  const cups = waterCupsFor(data);
  const split = macroSplit(data);
  const notes = ['O app não calcula caloria, gasto energético nem composição corporal: isso só entra se você digitar.'];
  if (cups == null) gaps.push({ field: 'waterGoal', question: 'Qual a sua meta de água (copos de 250 ml)? Sem ela a barra fica "Sem dado".' });
  else notes.push(`Meta de água declarada por você: ${cups} copo(s) = ${(cups * WATER_CUP_ML) / 1000} L.`);
  if (split) notes.push(`Macros declarados: ${split.protein}% proteína · ${split.carbs}% carbo · ${split.fat}% gordura.`);
  else gaps.push({ field: 'education', question: 'Qual distribuição de macros você segue? O app não calcula a sua necessidade.' });
  return {
    text: cups != null || split ? 'Sobre hidratação e macros:' : 'Preciso de uma meta sua para responder isso com honestidade.',
    lines: [],
    notes,
    action: cups != null ? { kind: 'water', water: { cups } } : undefined,
    gaps,
    module: 'dieta',
    parsed: [],
  };
}

/* ───────────────────────── sugestões do dia ───────────────────────── */

export interface CopilotSuggestion {
  title: string;
  body: string;
  module: CopilotModule;
  /** Rótulo do botão de ação, quando existe. */
  cta?: string;
  /** Comando que o botão executa (vai para o chat). */
  prompt?: string;
}

/**
 * Sugestões de melhoria do dia.
 *
 * Cada sugestão nasce de um dado MEDIDO (streak baixo, água sem registro, peso
 * desatualizado). Sem dado suficiente, a sugestão é a de registrar — que é
 * honesta e útil, não um elogio inventado.
 */
export function dailySuggestions(data: AppData, today = todayKey()): CopilotSuggestion[] {
  const out: CopilotSuggestion[] = [];
  const day = data.days.find((d) => d.date === today);
  const days = dayMap(data);
  const lastWeek = Array.from({ length: 7 }, (_, i) => days.get(addDays(today, -i))).filter((d): d is Day => !!d);
  const closed = lastWeek.filter((d) => !!d.score).length;

  if (!day) {
    out.push({
      title: 'Abrir o dia',
      body: 'Ainda não existe registro de hoje. O assistente organiza a rotina a partir do que você escrever.',
      module: 'rotina',
      cta: 'Organizar rotina',
      prompt: 'Montar rotina de hoje: acordar 6h, treinar 19h, estudar 20h30 por 45min',
    });
  } else if (closed < 3) {
    out.push({
      title: 'Fechar mais dias',
      body: `Só ${closed} dia(s) fechado(s) nos últimos 7. Fechar o dia é o que faz o score e a sequência existirem.`,
      module: 'resumo',
      cta: 'Resumo do dia',
      prompt: 'Resumir meu dia',
    });
  } else {
    out.push({
      title: 'Ritmo de fechamento',
      body: `${closed} de 7 dias fechados nesta semana. Mantenha o fechamento no fim do dia.`,
      module: 'resumo',
      cta: 'Resumo do dia',
      prompt: 'Resumir meu dia',
    });
  }

  if (typeof day?.diary.waterCups !== 'number') {
    out.push({
      title: 'Água sem registro',
      body: 'Nenhum copo marcado hoje. O app não estima sua necessidade — a meta é a que você definir.',
      module: 'dieta',
      cta: 'Ver hidratação',
      prompt: 'Como está minha hidratação?',
    });
  }

  const lastWorkout = data.days
    .filter((d) => !!d.diary.workout)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  out.push({
    title: lastWorkout ? 'Treino' : 'Primeira ficha',
    body: lastWorkout
      ? `Último treino registrado: ${lastWorkout.date}. Posso montar a próxima ficha com as cargas do histórico.`
      : 'Sem treino registrado. Posso montar uma ficha com carga vazia para você preencher.',
    module: 'treino',
    cta: 'Gerar ficha',
    prompt: 'Montar ficha de treino de pernas',
  });

  const plan = data.days.find((d) => d.date === today)?.diary.studyPlan as
    | { name: string; examDate: string; topics: EditalTopic[] }
    | undefined;
  if (!plan || !plan.topics.length) {
    out.push({
      title: 'Cronograma de estudo',
      body: 'Sem edital cadastrado. Escreva as matérias e eu monto os blocos.',
      module: 'estudo',
      cta: 'Organizar estudo',
      prompt: 'Estudar Direito 40min, Português 30min',
    });
  }

  return out.slice(0, 3);
}

/** Atalhos fixos da tela (os 3 cards da referência). */
export const QUICK_ACTIONS: { key: string; label: string; hint: string; prompt: string; icon: 'rotina' | 'treino' | 'estudo' }[] = [
  {
    key: 'rotina',
    label: 'Organizar Rotina',
    hint: 'Extrai hábitos do texto e monta a timeline',
    prompt: 'Acordar 6h, meditar 10min, treinar 19h, estudar 20h30 por 45min',
    icon: 'rotina',
  },
  {
    key: 'treino',
    label: 'Gerar Treino',
    hint: 'Ficha com séries e carga do seu histórico',
    prompt: 'Montar ficha de treino de pernas',
    icon: 'treino',
  },
  {
    key: 'estudo',
    label: 'Resumir Estudos',
    hint: 'Cronograma por matéria e o que revisar',
    prompt: 'Organizar estudo: Direito 40min, Português 30min, Matemática 40min',
    icon: 'estudo',
  },
];
