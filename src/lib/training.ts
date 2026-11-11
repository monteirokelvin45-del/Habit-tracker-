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
}

export interface WorkoutSession {
  /** ISO do dia (YYYY-MM-DD). */
  date: string;
  /** Ex.: "Treino A — Peito e Tríceps". */
  label: string;
  exercises: ExerciseEntry[];
  /** Duração registrada pelo cronômetro, em segundos. */
  durationSec?: number;
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
