import { EMOTIONS, type AppData } from './types';
import { addDays, todayKey } from './date';

/**
 * Diário de emoções por registro (1–3 por dia, como no briefing do produto).
 *
 * Por que um log separado do `diary.emotions`:
 * `diary.emotions` só existe no dia **fechado** e guarda no máximo 3 emoções —
 * serve para o mapa da revisão, mas não como diário. O log aqui registra
 * *quando* a emoção apareceu (manhã/tarde/noite), aceita mais de um momento no
 * mesmo dia e por isso permite as perguntas que importam: qual emoção mais
 * aparece, com o que ela anda junto, e o que ela antecipa no dia seguinte.
 *
 * Regra 1 vale no arquivo inteiro: ausência de registro é `null`, nunca 0, e
 * correlação só é devolvida com amostra suficiente (≥ 4 registros de cada lado).
 */

export const EMOTION_MOMENTS = ['manhã', 'tarde', 'noite'] as const;
export type EmotionMoment = (typeof EMOTION_MOMENTS)[number];

export interface EmotionEntry {
  /** ISO completo (a hora do registro é o dado mais útil para o mapa). */
  at: string;
  /** Dia local `YYYY-MM-DD` — é por aqui que o mapa agrupa. */
  date: string;
  emotion: string;
  moment: EmotionMoment;
  intensity: number;
  note?: string;
}

export const MAX_EMOTIONS_PER_DAY = 3;
/** Abaixo disso não se fala em padrão (mesma lógica do gate de 7 dias). */
export const MIN_SAMPLES_CORRELATION = 4;

export function momentOf(isoHour: number): EmotionMoment {
  if (isoHour < 12) return 'manhã';
  if (isoHour < 18) return 'tarde';
  return 'noite';
}

export function isKnownEmotion(value: string): boolean {
  return (EMOTIONS as readonly string[]).includes(value);
}

/** Sanitiza uma entrada vinda do storage/backup: descarta o que não é registro. */
export function sanitizeEmotionEntry(raw: unknown): EmotionEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<EmotionEntry>;
  if (typeof e.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) return null;
  if (typeof e.emotion !== 'string' || !e.emotion.trim()) return null;
  const moment: EmotionMoment = EMOTION_MOMENTS.includes(e.moment as EmotionMoment)
    ? (e.moment as EmotionMoment)
    : 'manhã';
  const intensity = typeof e.intensity === 'number' && Number.isFinite(e.intensity)
    ? Math.min(5, Math.max(1, Math.round(e.intensity)))
    : 3;
  const at = typeof e.at === 'string' && !Number.isNaN(Date.parse(e.at))
    ? e.at
    : `${e.date}T12:00:00.000Z`;
  return {
    at,
    date: e.date,
    emotion: e.emotion.trim(),
    moment,
    intensity,
    ...(typeof e.note === 'string' && e.note.trim() ? { note: e.note.trim() } : {}),
  };
}

export function sanitizeEmotionLog(raw: unknown): EmotionEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(sanitizeEmotionEntry)
    .filter((e): e is EmotionEntry => e != null)
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/** Entradas de um dia, na ordem em que foram registradas. */
export function entriesOn(log: EmotionEntry[], date: string): EmotionEntry[] {
  return log.filter((e) => e.date === date);
}

/**
 * Cria a entrada do momento. Recusa emoção desconhecida e respeita o teto de 3
 * por dia — o limite é do produto, não da UI: se a tela esquecer, a lib barra.
 */
export function addEmotion(
  log: EmotionEntry[],
  input: { emotion: string; date?: string; moment?: EmotionMoment; intensity?: number; note?: string; now?: Date },
): { log: EmotionEntry[]; entry: EmotionEntry | null; reason?: string } {
  const now = input.now ?? new Date();
  const date = input.date ?? todayKey();
  if (!input.emotion.trim()) return { log, entry: null, reason: 'Escolha uma emoção.' };
  if (entriesOn(log, date).length >= MAX_EMOTIONS_PER_DAY) {
    return { log, entry: null, reason: `Você já registrou ${MAX_EMOTIONS_PER_DAY} emoções hoje.` };
  }
  // O carimbo é a chave de remoção: dois registros no mesmo milissegundo
  // (teste, toque duplo, importador) colidiriam e remover um apagaria os dois.
  let at = now.toISOString();
  let bump = 1;
  while (log.some((e) => e.at === at)) {
    at = new Date(now.getTime() + bump).toISOString();
    bump += 1;
  }
  const entry: EmotionEntry = {
    at,
    date,
    emotion: input.emotion.trim(),
    moment: input.moment ?? momentOf(now.getHours()),
    intensity: Math.min(5, Math.max(1, Math.round(input.intensity ?? 3))),
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
  };
  return { log: [...log, entry], entry };
}

export function removeEmotion(log: EmotionEntry[], at: string): EmotionEntry[] {
  return log.filter((e) => e.at !== at);
}

export interface EmotionStat {
  emotion: string;
  count: number;
  /** Intensidade média daquela emoção (1–5). */
  intensity: number;
  /** Em que momento do dia ela mais aparece. */
  commonMoment: EmotionMoment | null;
  /** Score médio dos dias em que ela apareceu (só dias fechados). */
  scoreWith: number | null;
}

/**
 * Ranking de emoções numa janela de dias.
 * `scoreWith` é média de score dos dias **fechados** em que a emoção aparece;
 * dia aberto não entra (não tem score) e dia sem emoção não é comparado aqui.
 */
export function emotionStats(data: AppData, log: EmotionEntry[], daysWindow = 30): EmotionStat[] {
  const from = addDays(todayKey(), -(daysWindow - 1));
  const inWindow = log.filter((e) => e.date >= from);
  const byEmotion = new Map<string, EmotionEntry[]>();
  for (const e of inWindow) {
    const list = byEmotion.get(e.emotion) ?? [];
    list.push(e);
    byEmotion.set(e.emotion, list);
  }
  const dayScore = new Map<string, number>();
  for (const d of data.days) if (d.score) dayScore.set(d.date, d.score.total);

  const stats: EmotionStat[] = [];
  for (const [emotion, list] of byEmotion) {
    const moments = new Map<EmotionMoment, number>();
    for (const e of list) moments.set(e.moment, (moments.get(e.moment) ?? 0) + 1);
    const momentsSorted = Array.from(moments.entries()).sort((a, b) => b[1] - a[1]);
    const scores = Array.from(new Set(list.map((e) => e.date)))
      .map((date) => dayScore.get(date))
      .filter((s): s is number => typeof s === 'number');
    stats.push({
      emotion,
      count: list.length,
      intensity: Math.round((list.reduce((sum, e) => sum + e.intensity, 0) / list.length) * 10) / 10,
      commonMoment: momentsSorted[0]?.[0] ?? null,
      scoreWith: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
    });
  }
  return stats.sort((a, b) => b.count - a.count || a.emotion.localeCompare(b.emotion));
}

/**
 * Emoção × score do dia seguinte.
 *
 * Método: pareia cada dia **registrado** com o score do dia seguinte e compara a
 * média dos dias em que a emoção apareceu com a média dos dias em que ela não
 * apareceu. Devolve `null` se algum dos lados tiver menos de
 * `MIN_SAMPLES_CORRELATION` dias com score — é a regra 4 aplicada a emoção:
 * não se afirma padrão com amostra pequena.
 */
export function emotionEffect(data: AppData, log: EmotionEntry[], emotion: string) {
  const nextScore = new Map<string, number>();
  for (const d of data.days) if (d.score) nextScore.set(d.date, d.score.total);
  const daysWith = new Set(log.filter((e) => e.emotion === emotion).map((e) => e.date));
  if (!daysWith.size) return null;

  const withEmotion: number[] = [];
  const without: number[] = [];
  for (const date of Array.from(nextScore.keys()).sort()) {
    const next = nextScore.get(addDays(date, 1));
    if (next == null) continue;
    if (daysWith.has(date)) withEmotion.push(next);
    else without.push(next);
  }
  if (withEmotion.length < MIN_SAMPLES_CORRELATION || without.length < MIN_SAMPLES_CORRELATION) {
    return {
      emotion,
      eligible: false as const,
      missing: Math.max(0, MIN_SAMPLES_CORRELATION - Math.min(withEmotion.length, without.length)),
      sample: withEmotion.length,
    };
  }
  const avgWith = withEmotion.reduce((a, b) => a + b, 0) / withEmotion.length;
  const avgWithout = without.reduce((a, b) => a + b, 0) / without.length;
  const delta = Math.round((avgWith - avgWithout) * 10) / 10;
  return {
    emotion,
    eligible: true as const,
    delta,
    avgWith: Math.round(avgWith * 10) / 10,
    avgWithout: Math.round(avgWithout * 10) / 10,
    sample: withEmotion.length,
  };
}

/** Frase do resultado. Nunca acusa: descreve o que os números mostram. */
export function effectLine(result: NonNullable<ReturnType<typeof emotionEffect>>): string {
  if (!result.eligible) {
    return `Ainda sem base: faltam ${result.missing} dia(s) com score de um dos lados.`;
  }
  if (Math.abs(result.delta) < 0.3) {
    return `Nos ${result.sample} dia(s) com ${result.emotion}, o score seguinte ficou igual ao resto (${result.avgWith} vs ${result.avgWithout}).`;
  }
  return result.delta > 0
    ? `Nos ${result.sample} dia(s) com ${result.emotion}, o score seguinte foi ${result.delta} maior (${result.avgWith} vs ${result.avgWithout}).`
    : `Nos ${result.sample} dia(s) com ${result.emotion}, o score seguinte foi ${Math.abs(result.delta)} menor (${result.avgWith} vs ${result.avgWithout}).`;
}

export interface EmotionGridCell {
  date: string;
  /** Emoção dominante do dia (mais registrada); `null` = dia sem registro. */
  emotion: string | null;
  count: number;
  intensity: number | null;
}

/**
 * Grade do mapa de calor: um quadrado por dia, 7 por linha (semana).
 * Dia sem registro mantém `emotion: null` para a UI pintar de "sem dado".
 */
export function emotionGrid(log: EmotionEntry[], weeks = 12, endDate = todayKey()): EmotionGridCell[][] {
  const rows: EmotionGridCell[][] = [];
  const start = addDays(endDate, -(weeks * 7 - 1));
  for (let w = 0; w < weeks; w += 1) {
    const row: EmotionGridCell[] = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, w * 7 + d);
      const entries = entriesOn(log, date);
      if (!entries.length) {
        row.push({ date, emotion: null, count: 0, intensity: null });
        continue;
      }
      const tally = new Map<string, number>();
      for (const e of entries) tally.set(e.emotion, (tally.get(e.emotion) ?? 0) + 1);
      const dominant = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])[0]![0];
      row.push({
        date,
        emotion: dominant,
        count: entries.length,
        intensity: Math.round((entries.reduce((sum, e) => sum + e.intensity, 0) / entries.length) * 10) / 10,
      });
    }
    rows.push(row);
  }
  return rows;
}

/** Dias seguidos com pelo menos 1 emoção registrada, contando de trás para frente. */
export function emotionStreak(log: EmotionEntry[], endDate = todayKey()): number {
  const dates = new Set(log.map((e) => e.date));
  let streak = 0;
  let cursor = endDate;
  // Hoje ainda pode ser registrado: um dia em aberto não zera a sequência.
  if (!dates.has(cursor)) cursor = addDays(cursor, -1);
  while (dates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** Emoção que mais aparece nos `days` dias (para o card de destaque). */
export function topEmotion(log: EmotionEntry[], days = 30, endDate = todayKey()): EmotionStat['emotion'] | null {
  const from = addDays(endDate, -(days - 1));
  const tally = new Map<string, number>();
  for (const e of log) if (e.date >= from && e.date <= endDate) tally.set(e.emotion, (tally.get(e.emotion) ?? 0) + 1);
  const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

/** Emoções que aparecem juntas no mesmo dia (top 5 pares). */
export function emotionPairs(log: EmotionEntry[], days = 60, endDate = todayKey()) {
  const from = addDays(endDate, -(days - 1));
  const byDate = new Map<string, Set<string>>();
  for (const e of log) {
    if (e.date < from || e.date > endDate) continue;
    const set = byDate.get(e.date) ?? new Set<string>();
    set.add(e.emotion);
    byDate.set(e.date, set);
  }
  const pairs = new Map<string, number>();
  for (const set of byDate.values()) {
    const list = Array.from(set).sort();
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const key = `${list[i]} + ${list[j]}`;
        pairs.set(key, (pairs.get(key) ?? 0) + 1);
      }
    }
  }
  return Array.from(pairs.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

/** Espelho para o `diary.emotions` do dia (o mapa das revisões lê de lá). */
export function diaryEmotionsFor(log: EmotionEntry[], date: string): string[] {
  const seen: string[] = [];
  for (const e of entriesOn(log, date)) if (!seen.includes(e.emotion)) seen.push(e.emotion);
  return seen.slice(0, MAX_EMOTIONS_PER_DAY);
}
