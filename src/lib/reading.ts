/**
 * Leitura: progresso por páginas, velocidade e estimativa de conclusão.
 *
 * A velocidade só existe com histórico real (≥ 2 registros). Sem isso, a tela
 * diz "sem dado" em vez de estimar no chute — é a regra 1 aplicada a métrica.
 */

export interface BookProgress {
  title: string;
  author: string;
  totalPages: number;
  currentPage: number;
  /** Páginas lidas hoje. */
  todayPages: number;
  startedAt?: string;
  finishedAt?: string;
  quote?: string;
  reflection?: string;
}

/**
 * Fração lida do livro.
 *
 * `null` quando o total de páginas é desconhecido (0/ausente): "0%" afirmaria
 * que a pessoa não leu nada, quando na verdade o app não sabe o tamanho do
 * livro. Quem exibe deve escrever "Sem dado".
 */
export function bookPercent(book: BookProgress): number | null {
  const total = Number(book?.totalPages);
  if (!Number.isFinite(total) || total <= 0) return null;
  const current = Number.isFinite(Number(book?.currentPage)) ? Number(book.currentPage) : 0;
  return Math.min(1, Math.max(0, current / total));
}

export function pagesLeft(book: BookProgress): number {
  return Math.max(0, book.totalPages - book.currentPage);
}

/**
 * Velocidade média (páginas/dia) com base nas datas registradas.
 * `null` quando não há base suficiente para afirmar algo.
 */
export function pagesPerDay(history: { date: string; page: number }[]): number | null {
  if (history.length < 2) return null;
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const days = Math.max(
    1,
    Math.round((new Date(`${last.date}T12:00:00`).getTime() - new Date(`${first.date}T12:00:00`).getTime()) / 86_400_000),
  );
  const pages = last.page - first.page;
  if (pages <= 0) return null;
  return Math.round((pages / days) * 10) / 10;
}

export interface FinishEstimate {
  days: number | null;
  label: string;
}

/** Estimativa de conclusão: "≈ 9 dias · 24/11" só quando há velocidade medida. */
export function daysToFinish(
  book: BookProgress,
  speed: number | null,
  today: string,
): FinishEstimate {
  const left = pagesLeft(book);
  if (left === 0) return { days: 0, label: 'concluído' };
  if (!speed || speed <= 0) return { days: null, label: 'sem dado de velocidade' };
  const days = Math.ceil(left / speed);
  const date = new Date(`${today}T12:00:00`);
  date.setDate(date.getDate() + days);
  const label = `≈ ${days} dia${days > 1 ? 's' : ''} · ${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  return { days, label };
}

/** Aplica páginas lidas hoje (nunca passa do total nem volta abaixo de 0). */
export function applyPages(book: BookProgress, pages: number): BookProgress {
  const currentPage = Math.min(book.totalPages, Math.max(0, book.currentPage + pages));
  return {
    ...book,
    currentPage,
    todayPages: Math.max(0, book.todayPages + pages),
    finishedAt: currentPage >= book.totalPages ? book.finishedAt ?? new Date().toISOString().slice(0, 10) : undefined,
  };
}

/** Série de progresso para o gráfico (páginas acumuladas por dia). */
export function progressSeries(
  history: { date: string; page: number }[],
): { labels: string[]; points: number[] } {
  const sorted = [...history].sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    labels: sorted.map((h) => h.date.slice(8)),
    points: sorted.map((h) => h.page),
  };
}
