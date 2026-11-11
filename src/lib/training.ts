/**
 * Treino: modelo de sessão com séries, cargas e volume.
 *
 * Regra de honestidade do app: a sessão só conta como registrada quando as
 * séries são marcadas. Comparativo de carga usa a ÚLTIMA sessão daquele
 * exercício — se não existe, é "sem referência", não 0 kg.
 */

export interface SetEntry {
  reps: number;
  /** kg; `null` = peso corporal / sem carga informada. */
  weight: number | null;
  done: boolean;
}

export interface ExerciseEntry {
  name: string;
  sets: SetEntry[];
  note?: string;
  /** Descanso prescrito entre séries, em segundos. */
  restSec?: number;
  /** Grupo muscular principal ("Quads", "Peito"...). Ver `MUSCLE_GROUPS`. */
  muscle?: string;
}

export type WorkoutKind = 'forca' | 'cardio';

export interface WorkoutSession {
  /** ISO do dia (YYYY-MM-DD). */
  date: string;
  /** Ex.: "Treino A — Peito e Tríceps". */
  label: string;
  exercises: ExerciseEntry[];
  /** Duração registrada pelo cronômetro, em segundos. */
  durationSec?: number;
  /** Força (carga) ou cardio — é o que separa as duas barras do volume. */
  kind?: WorkoutKind;
  /** Minutos de cardio registrados à parte (cardio não tem série). */
  cardioMin?: number;
  /** Estimativa de gasto informada PELA PESSOA. O app não calcula caloria. */
  kcal?: number;
  /** Frequência média cardíaca informada pela pessoa (bpm). */
  bpm?: number;
}

/**
 * Grupos musculares com sinônimos para reconhecer o exercício pelo nome.
 * Não é um catálogo fechado: exercício desconhecido fica sem grupo, e a tela
 * diz isso em vez de chutar um músculo.
 */
export const MUSCLE_GROUPS: { name: string; keys: string[] }[] = [
  { name: 'Quads', keys: ['agachamento', 'squat', 'leg press', 'cadeira extensora', 'afundo', 'avanço', 'lunge', 'hack'] },
  { name: 'Posterior', keys: ['stiff', 'flexora', 'mesa flexora', 'romanian', 'rdl', 'levantamento terra', 'deadlift'] },
  { name: 'Glúteos', keys: ['glúteo', 'gluteo', 'hip thrust', 'elevação pélvica', 'coice', 'abdução'] },
  { name: 'Panturrilha', keys: ['panturrilha', 'gêmeos', 'gemeos', 'calf'] },
  { name: 'Peito', keys: ['supino', 'peito', 'crucifixo', 'flexão', 'flexao', 'peck deck', 'crossover', 'chest'] },
  { name: 'Costas', keys: ['remada', 'puxada', 'barra fixa', 'pull', 'pulldown', 'serrote', 'back'] },
  { name: 'Ombros', keys: ['desenvolvimento', 'ombro', 'elevação lateral', 'elevacao lateral', 'militar', 'arnold', 'shoulder'] },
  { name: 'Bíceps', keys: ['rosca', 'bíceps', 'biceps', 'curl'] },
  { name: 'Tríceps', keys: ['tríceps', 'triceps', 'testa', 'corda', 'mergulho'] },
  { name: 'Core', keys: ['abdominal', 'core', 'prancha', 'crunch', 'elevação de pernas', 'russian twist'] },
  { name: 'Cardio', keys: ['corrida', 'bike', 'bicicleta', 'elíptico', 'eliptico', 'esteira', 'remo', 'cardio', 'corda', 'natação', 'natacao'] },
];

/** Grupo muscular do exercício pelo nome; `null` quando não reconhece. */
export function exerciseMuscle(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  for (const g of MUSCLE_GROUPS) {
    if (g.keys.some((k) => n.includes(k))) return g.name;
  }
  return null;
}

/** Grupo registrado no exercício ou, na falta, o reconhecido pelo nome. */
export function muscleOf(ex: ExerciseEntry): string | null {
  return ex.muscle?.trim() || exerciseMuscle(ex.name);
}

/** Volume total = soma de (reps × carga) das séries feitas. Peso corporal conta 0. */
export function sessionVolume(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, ex) =>
      total +
      ex.sets.reduce((sum, set) => sum + (set.done ? set.reps * (set.weight ?? 0) : 0), 0),
    0,
  );
}

/** Séries concluídas / séries planejadas. */
export function sessionProgress(session: WorkoutSession): { done: number; total: number; ratio: number } {
  const total = session.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
  const done = session.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.done).length, 0);
  return { done, total, ratio: total ? done / total : 0 };
}

/** Maior carga feita em um exercício (ignora séries não marcadas e sem peso). */
export function topWeight(exercise: ExerciseEntry): number | null {
  const weights = exercise.sets.filter((s) => s.done && s.weight != null).map((s) => s.weight as number);
  return weights.length ? Math.max(...weights) : null;
}

export interface LoadDelta {
  current: number | null;
  previous: number | null;
  /** kg de diferença; `null` quando falta uma das duas referências. */
  delta: number | null;
  label: string;
}

/**
 * Comparativo de carga com a última sessão do mesmo exercício.
 * Sem referência anterior, diz "primeira sessão registrada" — não inventa ganho.
 */
export function loadDelta(current: ExerciseEntry, history: WorkoutSession[]): LoadDelta {
  const now = topWeight(current);
  const previous = [...history]
    .reverse()
    .map((s) => s.exercises.find((e) => e.name.trim().toLowerCase() === current.name.trim().toLowerCase()))
    .find((e): e is ExerciseEntry => !!e);
  const prev = previous ? topWeight(previous) : null;

  if (now == null) {
    return { current: null, previous: prev, delta: null, label: 'Sem carga registrada' };
  }
  if (prev == null) {
    return { current: now, previous: null, delta: null, label: 'primeira sessão registrada' };
  }
  const delta = Math.round((now - prev) * 10) / 10;
  if (delta === 0) return { current: now, previous: prev, delta, label: 'mesma carga da última' };
  return {
    current: now,
    previous: prev,
    delta,
    label: `${delta > 0 ? '+' : '−'}${Math.abs(delta)}kg vs última`,
  };
}

/** Série progressiva para o gráfico de carga: só os dias com registro daquele exercício. */
export function loadSeries(
  history: WorkoutSession[],
  exerciseName: string,
): { date: string; weight: number }[] {
  const key = exerciseName.trim().toLowerCase();
  return history
    .map((session) => {
      const ex = session.exercises.find((e) => e.name.trim().toLowerCase() === key);
      const weight = ex ? topWeight(ex) : null;
      return weight == null ? null : { date: session.date, weight };
    })
    .filter((p): p is { date: string; weight: number } => !!p)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Formata duração do treino (cronômetro) para mm:ss / h:mm:ss. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/* ─────────────────────── leituras do histórico ─────────────────────── */

/**
 * Sessão registrada = pelo menos uma série feita OU cardio com minutos.
 * Cardio não tem série, então exigir série apagaria todo treino de cardio.
 */
export function isRecorded(session: WorkoutSession | null | undefined): session is WorkoutSession {
  if (!session) return false;
  return sessionProgress(session).done > 0 || (session.cardioMin ?? 0) > 0;
}

export interface TrainingStats {
  /** Sessões realizadas na janela (só as com série feita). */
  total: number;
  /** Minutos de treino somados (cronômetro registrado). */
  activeMinutes: number;
  /** Série de dias consecutivos com treino, terminando hoje ou ontem. */
  streak: number;
  /** Maior sequência de dias do histórico. */
  best: number;
}

/** Sequência de dias com treino. Hoje sem treino não zera: a série vem de ontem. */
export function trainingStreak(sessions: WorkoutSession[], today: string): { streak: number; best: number } {
  const byDate = new Set(sessions.filter(isRecorded).map((s) => s.date));
  if (!byDate.size) return { streak: 0, best: 0 };
  // `date - n` sem depender de Date local: as chaves são YYYY-MM-DD ordenáveis.
  const shift = (key: string, days: number) => {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  let cursor = byDate.has(today) ? today : shift(today, -1);
  let streak = 0;
  for (let i = 0; i < 4000; i++) {
    if (!byDate.has(cursor)) break;
    streak += 1;
    cursor = shift(cursor, -1);
  }
  const sorted = [...byDate].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && shift(prev, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    prev = day;
  }
  return { streak, best };
}

/** Minutos de treino: cronômetro quando existe; senão, cardio declarado. */
export function sessionMinutes(session: WorkoutSession): number {
  const clock = Math.round((session.durationSec ?? 0) / 60);
  if (clock > 0) return clock;
  return Math.max(0, Math.round(session.cardioMin ?? 0));
}

/**
 * Volume separado por tipo na semana: força (reps × carga) e cardio (minutos).
 * `null` no dia sem sessão — a barra fica oca; zero seria "treinou zero série".
 */
export function weeklyVolume(
  sessions: WorkoutSession[],
  days: string[],
): { date: string; strength: number | null; cardio: number | null }[] {
  const byDate = new Map(sessions.map((s) => [s.date, s]));
  return days.map((date) => {
    const s = byDate.get(date);
    if (!isRecorded(s)) return { date, strength: null, cardio: null };
    const kind = s.kind ?? (s.cardioMin && !sessionVolume(s) ? 'cardio' : 'forca');
    return {
      date,
      strength: kind === 'cardio' ? 0 : Math.round(sessionVolume(s)),
      cardio: kind === 'cardio' || (s.cardioMin ?? 0) > 0 ? Math.round(s.cardioMin ?? 0) : 0,
    };
  });
}

export interface PersonalRecord {
  exercise: string;
  weight: number;
  /** Data da melhor carga. */
  date: string;
  /** kg acima da sessão anterior daquele exercício; `null` se foi a primeira. */
  delta: number | null;
}

/**
 * Recordes pessoais: maior carga feita por exercício e quanto isso subiu em
 * relação à sessão ANTERIOR daquele exercício. Sem sessão anterior, `delta`
 * é `null` (primeira vez) — o app não inventa "+5kg".
 */
export function personalRecords(sessions: WorkoutSession[], limit = 3): PersonalRecord[] {
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));
  const best = new Map<string, { weight: number; date: string; delta: number | null }>();
  const previous = new Map<string, number>();

  for (const s of ordered) {
    for (const ex of s.exercises) {
      const name = ex.name.trim();
      if (!name) continue;
      const w = topWeight(ex);
      if (w == null) continue;
      const key = name.toLowerCase();
      const prev = previous.get(key) ?? null;
      const current = best.get(key);
      if (!current || w > current.weight) {
        best.set(key, { weight: w, date: s.date, delta: prev == null ? null : Math.round((w - prev) * 10) / 10 });
      }
      previous.set(key, Math.max(prev ?? w, w));
    }
  }

  return [...best.entries()]
    .map(([key, v]) => ({ exercise: key, weight: v.weight, date: v.date, delta: v.delta }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((r) => ({ ...r, exercise: r.exercise.replace(/\b\w/g, (c) => c.toUpperCase()) }));
}
