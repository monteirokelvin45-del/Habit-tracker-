/**
 * Modelo puro do timer de foco.
 *
 * Fica fora da tela para poder ser testado sem relógio real: a tela só chama
 * `tick` a cada segundo e desenha `remaining`/`progress`. Nenhuma regra aqui
 * depende de `Date.now()`, então o mesmo estado é reproduzível em teste.
 */

export type TimerPhase = 'focus' | 'rest';
export type TimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface TimerState {
  phase: TimerPhase;
  status: TimerStatus;
  /** Segundos restantes na fase atual. */
  remaining: number;
  /** Duração da fase atual, em segundos (base do progresso). */
  total: number;
  /** Ciclos de foco completados desde o início da sessão. */
  cycles: number;
}

export interface TimerConfig {
  focus: number;
  rest: number;
}

export const PRESETS: TimerConfig[] = [
  { focus: 25, rest: 5 },
  { focus: 50, rest: 10 },
  { focus: 90, rest: 20 },
];

export function presetLabel(p: TimerConfig): string {
  return `${p.focus} / ${p.rest}`;
}

export function initTimer(config: TimerConfig): TimerState {
  return { phase: 'focus', status: 'idle', remaining: config.focus * 60, total: config.focus * 60, cycles: 0 };
}

export interface TickResult {
  state: TimerState;
  /** O que acabou de acontecer neste tick (a tela dispara haptic/notificação). */
  event: 'none' | 'focus-done' | 'rest-done';
}

/**
 * Um segundo se passou.
 *
 * Fim de foco → entra em pausa já com o tempo da pausa (o ciclo conta na hora).
 * Fim de pausa → volta para foco **parado**: retomar é escolha, não automático.
 */
export function tick(state: TimerState, config: TimerConfig): TickResult {
  if (state.status !== 'running') return { state, event: 'none' };
  const remaining = state.remaining - 1;
  if (remaining > 0) return { state: { ...state, remaining }, event: 'none' };

  if (state.phase === 'focus') {
    return {
      state: {
        phase: 'rest',
        status: 'running',
        remaining: config.rest * 60,
        total: config.rest * 60,
        cycles: state.cycles + 1,
      },
      event: 'focus-done',
    };
  }
  return {
    state: {
      phase: 'focus',
      status: 'paused',
      remaining: config.focus * 60,
      total: config.focus * 60,
      cycles: state.cycles,
    },
    event: 'rest-done',
  };
}

export function start(state: TimerState): TimerState {
  if (state.status === 'finished') return state;
  return { ...state, status: 'running' };
}

export function pause(state: TimerState): TimerState {
  return state.status === 'running' ? { ...state, status: 'paused' } : state;
}

export function toggle(state: TimerState): TimerState {
  return state.status === 'running' ? pause(state) : start(state);
}

export function reset(config: TimerConfig, cycles = 0): TimerState {
  return { ...initTimer(config), cycles };
}

/** 0..1 de quanto já correu na fase. */
export function progress(state: TimerState): number {
  if (state.total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - state.remaining / state.total));
}

export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Estimativa do próximo ciclo (quando termina), só para exibir. `null` se parado. */
export function endsAt(state: TimerState, nowMs: number): Date | null {
  if (state.status !== 'running') return null;
  return new Date(nowMs + state.remaining * 1000);
}

/**
 * Minutos de foco efetivos de uma sessão — usado para não gravar ciclo que não
 * chegou ao fim. Ciclo interrompido não é tempo de foco registrado.
 */
export function focusMinutesOf(state: TimerState, config: TimerConfig): number {
  return state.cycles * config.focus;
}
