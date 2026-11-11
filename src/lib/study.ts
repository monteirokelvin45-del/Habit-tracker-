/**
 * Estudo: blocos, material, resumo ativo e dúvidas para revisar.
 *
 * O detector de fuga é iniciado pela tela de foco (`Modo Foco Rígido`) e a
 * cobrança é registrada no diário via `patchDiary` — nada de estado paralelo.
 */

export interface StudyBlock {
  /** Ex.: "Matemática — derivadas". */
  subject: string;
  plannedMinutes: number;
  /** Minutos realmente estudados (pomodoro ou cronômetro). */
  doneMinutes: number;
  material: 'Livro' | 'Vídeo' | 'PDF' | 'Aula' | 'Outro';
  materialRef?: string;
  learned?: string;
  doubts: string[];
}

export function studyProgress(blocks: StudyBlock[]): { planned: number; done: number; ratio: number } {
  const planned = blocks.reduce((sum, b) => sum + (b.plannedMinutes || 0), 0);
  const done = blocks.reduce((sum, b) => sum + (b.doneMinutes || 0), 0);
  return { planned, done, ratio: planned ? Math.min(1, done / planned) : 0 };
}

/** Doubts abertas viram fila de revisão: cada uma com o assunto de origem. */
export function pendingDoubts(blocks: StudyBlock[]): { subject: string; doubt: string }[] {
  return blocks.flatMap((b) => b.doubts.filter((d) => d.trim()).map((doubt) => ({ subject: b.subject, doubt })));
}

/** Horas por matéria em uma janela de dias (para o gráfico do histórico). */
export function minutesBySubject(
  days: { diary: unknown }[],
  windowDays: number,
): { subject: string; minutes: number }[] {
  const map = new Map<string, number>();
  for (const day of days.slice(-windowDays)) {
    const blocks = (day.diary as { study?: StudyBlock[] })?.study ?? [];
    for (const b of blocks) {
      map.set(b.subject, (map.get(b.subject) ?? 0) + (b.doneMinutes || 0));
    }
  }
  return [...map.entries()]
    .map(([subject, minutes]) => ({ subject, minutes }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** Duração da sessão pomodoro a partir do preset (25/5 ou 50/10). */
export function pomodoroPreset(preset: '25/5' | '50/10'): { focus: number; rest: number } {
  return preset === '50/10' ? { focus: 50, rest: 10 } : { focus: 25, rest: 5 };
}
