/**
 * Finanças: orçamento em baldes e a "Regra do Dia de Pagamento".
 *
 * Três baldes fixos (necessidade / vontade / futuro). Qualquer percentual que não
 * esteja definido nas configurações NÃO é inventado: a função devolve `null` e a
 * tela escreve "Sem dado".
 *
 * Regra do Dia de Pagamento (payday): a regra não é "gaste o que sobrar", é
 * "separe no dia em que o dinheiro entra". A função diz quanto deveria ter sido
 * separado de cada balde no pagamento e quanto realmente foi lançado depois dele.
 */

import type { FinanceEntry } from './types';

export type BucketKey = 'necessidade' | 'vontade' | 'futuro';

export interface BucketDef {
  key: BucketKey;
  label: string;
  hint: string;
}

export const BUCKETS: BucketDef[] = [
  { key: 'necessidade', label: 'Necessidade', hint: 'o que sustenta o mês: moradia, comida, transporte' },
  { key: 'vontade', label: 'Vontade', hint: 'prazer planejado — não é proibido, é limitado' },
  { key: 'futuro', label: 'Futuro', hint: 'sai primeiro: reserva e dívida' },
];

/** Divisão clássica 50/30/20 usada quando o usuário não definiu a dele. */
export const DEFAULT_SPLIT: Record<BucketKey, number> = {
  necessidade: 50,
  vontade: 30,
  futuro: 20,
};

export function splitTotal(split: Record<BucketKey, number>): number {
  return BUCKETS.reduce((sum, b) => sum + (split[b.key] ?? 0), 0);
}

/** Percentual válido é o que soma 100. Fora disso, a divisão declarada não vale. */
export function splitIsValid(split: Record<BucketKey, number>): boolean {
  return Math.abs(splitTotal(split) - 100) < 0.5;
}

export interface BucketTarget {
  key: BucketKey;
  label: string;
  percent: number;
  /** Valor-alvo no mês. `null` quando não há renda registrada. */
  target: number | null;
  /** Quanto já foi lançado nesse balde. */
  used: number;
  /** Sobra do balde (pode ser negativa). `null` sem alvo. */
  left: number | null;
  /** 0..1+ — `null` sem alvo. */
  ratio: number | null;
}

/**
 * Categoria → balde. "Vontade" é a única que aceita impulso: gasto por impulso
 * dentro de uma necessidade continua sendo necessidade, mas a tela avisa.
 */
const BUCKET_BY_CATEGORY: Record<string, BucketKey> = {
  'Alimentação': 'necessidade',
  Transporte: 'necessidade',
  Fixo: 'necessidade',
  Lazer: 'vontade',
  Impulso: 'vontade',
  Outros: 'vontade',
  Investimento: 'futuro',
};

export function bucketOf(category: string): BucketKey {
  return BUCKET_BY_CATEGORY[category] ?? 'vontade';
}

/**
 * Alvos e uso dos baldes no mês `monthKey` (YYYY-MM).
 *
 * `income` é a soma das receitas do mês. Sem receita, todo alvo é `null` — a
 * tela mostra "Sem dado", nunca zero silencioso.
 */
export function bucketTargets(
  entries: FinanceEntry[],
  monthKey: string,
  split: Record<BucketKey, number> = DEFAULT_SPLIT,
): BucketTarget[] {
  // Defesa local: a tela e o storage já sanitizam, mas esta função é chamada com
  // dados de snapshot/backup antigo. Um `amount` nulo ou em texto viraria
  // `used = NaN` e contaminaria alvos, sobra e %. Só entra número finito > 0.
  const amountOf = (e: FinanceEntry): number => {
    const raw = (e as { amount?: unknown }).amount;
    const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.replace(',', '.').trim()) : Number.NaN;
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const safeEntries = (Array.isArray(entries) ? entries : []).filter(
    (e) => e && typeof e.date === 'string' && e.date.startsWith(monthKey),
  );
  const month = safeEntries;
  const income = month.filter((e) => e.type === 'income').reduce((a, b) => a + amountOf(b), 0);
  return BUCKETS.map((b) => {
    const rawPercent = split[b.key] ?? 0;
    const percent = Number.isFinite(rawPercent) ? rawPercent : 0;
    const target = income > 0 ? (income * percent) / 100 : null;
    const used = month
      .filter((e) => e.type === 'expense' && bucketOf(e.category) === b.key)
      .reduce((a, c) => a + amountOf(c), 0);
    return {
      key: b.key,
      label: b.label,
      percent,
      target,
      used,
      left: target == null ? null : target - used,
      ratio: target == null || target === 0 ? null : used / target,
    };
  });
}

export interface PaydayCheck {
  /** Data do pagamento (`YYYY-MM-DD`). */
  date: string;
  /** Salário/receita que entrou nesse dia. */
  received: number;
  /** Baldes com o que DEVERIA ter sido separado naquele dia. */
  expected: { key: BucketKey; label: string; amount: number }[];
  /** Quanto foi de fato para o balde Reserva/Investimento/Dívida até agora. */
  reserved: number;
  /** `reserved - expectedFuturo`; negativo = separou menos. `null` sem receita. */
  gap: number | null;
  /** Frase de cobrança sobre a escolha (não sobre a pessoa). */
  verdict: string;
}

/**
 * Regra do Dia de Pagamento: no dia em que entra dinheiro, o balde Futuro sai
 * primeiro. A regra é cumprida quando o valor reservado no mês alcança o alvo.
 */
export function paydayCheck(
  entries: FinanceEntry[],
  monthKey: string,
  split: Record<BucketKey, number> = DEFAULT_SPLIT,
): PaydayCheck | null {
  const month = entries.filter((e) => e.date.startsWith(monthKey));
  const incomes = month.filter((e) => e.type === 'income');
  if (!incomes.length) return null;

  const biggest = incomes.reduce((a, b) => (b.amount > a.amount ? b : a));
  const expected = BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    amount: (biggest.amount * (split[b.key] ?? 0)) / 100,
  }));
  const futureTarget = expected.find((e) => e.key === 'futuro')?.amount ?? 0;
  const reserved = month
    .filter((e) => e.type === 'expense' && bucketOf(e.category) === 'futuro')
    .reduce((a, c) => a + c.amount, 0);
  const gap = reserved - futureTarget;

  let verdict: string;
  if (futureTarget === 0) {
    verdict = 'Balde Futuro está em 0% da divisão: nada foi reservado no pagamento.';
  } else if (gap >= 0) {
    verdict = `Regra cumprida: R$ ${reserved.toFixed(0)} separados no pagamento (alvo R$ ${futureTarget.toFixed(0)}).`;
  } else {
    verdict = `Faltou separar R$ ${Math.abs(gap).toFixed(0)} no dia ${biggest.date} — o balde Futuro saiu depois dos outros.`;
  }

  return { date: biggest.date, received: biggest.amount, expected, reserved, gap, verdict };
}

/**
 * Dias entre o pagamento e o primeiro gasto de "vontade". Quanto menor, mais
 * rápido o dinheiro do mês virou prazer. `null` = nenhum gasto de vontade.
 */
export function daysUntilFirstWant(entries: FinanceEntry[], monthKey: string): number | null {
  const month = entries.filter((e) => e.date.startsWith(monthKey));
  const incomes = month.filter((e) => e.type === 'income');
  if (!incomes.length) return null;
  const payday = incomes.reduce((a, b) => (b.date > a.date ? b : a)).date;
  const wants = month
    .filter((e) => e.type === 'expense' && bucketOf(e.category) === 'vontade')
    .map((e) => e.date)
    .sort();
  if (!wants.length) return null;
  const first = wants[0];
  const diff = Math.round((new Date(`${first}T12:00:00`).getTime() - new Date(`${payday}T12:00:00`).getTime()) / 86400000);
  return diff < 0 ? null : diff;
}

/**
 * Custo de oportunidade do impulso em dias de balde Futuro: quantos dias do
 * alvo diário de reserva o impulso do mês consumiu. `null` sem alvo.
 */
export function impulseCostInFutureDays(
  entries: FinanceEntry[],
  monthKey: string,
  split: Record<BucketKey, number> = DEFAULT_SPLIT,
): number | null {
  const targets = bucketTargets(entries, monthKey, split);
  const future = targets.find((t) => t.key === 'futuro');
  if (!future || future.target == null || future.target === 0) return null;
  const impulse = entries
    .filter((e) => e.date.startsWith(monthKey) && e.isImpulse)
    .reduce((a, b) => a + b.amount, 0);
  if (impulse === 0) return 0;
  const dailyFutureTarget = future.target / 30;
  return dailyFutureTarget > 0 ? impulse / dailyFutureTarget : null;
}
