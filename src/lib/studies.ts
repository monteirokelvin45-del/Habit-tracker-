/**
 * Estudo: plano de estudo, edital (checklist de tópicos) e apoio a TDAH.
 *
 * Três coisas que a tela de Estudo precisa e que ficam fora dela para poderem
 * ser testadas: qual tópico estudar agora (por peso no edital e por tempo sem
 * revisão), como o plano está sendo cumprido, e quanto tempo de sessão faz
 * sentido para quem trava para começar (TDAH).
 *
 * Nada aqui estima progresso: tópico sem registro é "não estudado", não 0%.
 */

export type TopicStatus = 'novo' | 'estudado' | 'revisado';

export interface EditalTopic {
  id: string;
  subject: string;
  topic: string;
  /** Peso 1–5 declarado no edital. Sem peso = 3. */
  weight?: number;
  status: TopicStatus;
  /** Última vez que foi estudado/revisado (YYYY-MM-DD). */
  lastSeen?: string;
}

export interface StudyPlan {
  /** Nome do concurso/curso. */
  name: string;
  /** Data da prova (YYYY-MM-DD). */
  examDate: string;
  topics: EditalTopic[];
}

export const TOPIC_STATUS_LABEL: Record<TopicStatus, string> = {
  novo: 'não estudado',
  estudado: 'estudado',
  revisado: 'revisado',
};

export function planProgress(plan: StudyPlan): {
  total: number;
  studied: number;
  reviewed: number;
  /** 0..1 — `null` com edital vazio (não é 0%). */
  ratio: number | null;
} {
  const total = plan.topics.length;
  const studied = plan.topics.filter((t) => t.status !== 'novo').length;
  const reviewed = plan.topics.filter((t) => t.status === 'revisado').length;
  return { total, studied, reviewed, ratio: total === 0 ? null : studied / total };
}

/** Dias até a prova. `null` sem data válida; negativo = prova passou. */
export function daysToExam(plan: StudyPlan, today: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plan.examDate)) return null;
  const diff = new Date(`${plan.examDate}T12:00:00`).getTime() - new Date(`${today}T12:00:00`).getTime();
  return Math.round(diff / 86400000);
}

/**
 * Quantos tópicos precisam ser estudados por dia para cobrir o edital até a
 * prova. `null` quando não dá para calcular (sem data, sem tópicos ou prova
 * passada) — nunca um número inventado.
 */
export function topicsPerDayNeeded(plan: StudyPlan, today: string): number | null {
  const days = daysToExam(plan, today);
  const pending = plan.topics.filter((t) => t.status === 'novo').length;
  if (days == null || days <= 0 || pending === 0) return null;
  return pending / days;
}

const WEIGHT_DEFAULT = 3;

/** Peso do tópico (1–5, padrão 3). */
export function weightOf(topic: EditalTopic): number {
  const w = topic.weight ?? WEIGHT_DEFAULT;
  return Math.min(5, Math.max(1, w));
}

/**
 * Próximo tópico a estudar.
 *
 * Prioridade = peso do edital × tempo desde a última vez (dias). Tópico nunca
 * estudado tem a maior urgência; empate resolve pelo peso e depois pelo nome,
 * para o resultado ser estável.
 */
export function nextTopic(plan: StudyPlan, today: string): { topic: EditalTopic; reason: string } | null {
  if (!plan.topics.length) return null;
  const todayMs = new Date(`${today}T12:00:00`).getTime();
  const scoreOf = (t: EditalTopic) => {
    if (!t.lastSeen) return Number.POSITIVE_INFINITY;
    const age = Math.max(0, Math.round((todayMs - new Date(`${t.lastSeen}T12:00:00`).getTime()) / 86400000));
    return age * weightOf(t);
  };
  const sorted = [...plan.topics].sort((a, b) => {
    const sa = scoreOf(a);
    const sb = scoreOf(b);
    if (sa !== sb) return sb > sa ? 1 : -1;
    if (weightOf(a) !== weightOf(b)) return weightOf(b) - weightOf(a);
    return `${a.subject}${a.topic}`.localeCompare(`${b.subject}${b.topic}`);
  });
  const topic = sorted[0]!;
  const reason = !topic.lastSeen
    ? 'nunca estudado'
    : `peso ${weightOf(topic)} · ${Math.round(
        (todayMs - new Date(`${topic.lastSeen}T12:00:00`).getTime()) / 86400000,
      )}d sem revisão`;
  return { topic, reason };
}

/** Distribuição de tópicos por matéria, do maior peso para o menor. */
export function workloadBySubject(plan: StudyPlan): { subject: string; pending: number; weight: number }[] {
  const map = new Map<string, { pending: number; weight: number }>();
  for (const t of plan.topics) {
    const item = map.get(t.subject) ?? { pending: 0, weight: 0 };
    if (t.status === 'novo') item.pending += 1;
    item.weight += weightOf(t);
    map.set(t.subject, item);
  }
  return [...map.entries()]
    .map(([subject, v]) => ({ subject, ...v }))
    .sort((a, b) => b.weight - a.weight);
}

/* ─────────────────────────── apoio a TDAH ─────────────────────────── */

export interface AdhdSupport {
  /** Minutos sugeridos para a primeira sessão do dia. */
  firstSessionMinutes: number;
  /** Passos de 2 minutos para vencer o início. */
  startSteps: string[];
  /** Regra quando a sessão foi interrompida. */
  afterBreak: string;
}

/**
 * "Só 2 minutos" é a porta de entrada; a sessão real é curta por padrão.
 * Se a pessoa já estudou hoje, o texto muda — não repete a mesma fala o dia todo.
 */
export function adhdSupport(focusMinutesToday: number): AdhdSupport {
  if (focusMinutesToday <= 0) {
    return {
      firstSessionMinutes: 10,
      startSteps: [
        'Abra o material na página/timestamp exato que vai usar.',
        'Deixe o celular na outra ponta da mesa (ou no modo foco).',
        'Cronômetro de 2 minutos: só abrir e ler a primeira linha.',
      ],
      afterBreak: 'Sem sessão hoje: comece por 2 minutos, não pelo plano inteiro.',
    };
  }
  if (focusMinutesToday < 30) {
    return {
      firstSessionMinutes: 15,
      startSteps: [
        'Retome de onde parou — não recomece do zero.',
        'Uma dúvida por vez na fila de revisão.',
      ],
      afterBreak: `${focusMinutesToday} min já feitos: um bloco de 15 min fecha o mínimo.`,
    };
  }
  return {
    firstSessionMinutes: 25,
    startSteps: ['Você já passou do mínimo: agora é consolidar, não acumular.'],
    afterBreak: `${focusMinutesToday} min hoje. Próximo bloco de 25 min com pausa de 5.`,
  };
}

/** Sessão curta demais para contar como estudo? 2 min é o piso declarado. */
export const MIN_SESSION_MINUTES = 2;

export function countsAsSession(minutes: number): boolean {
  return minutes >= MIN_SESSION_MINUTES;
}
