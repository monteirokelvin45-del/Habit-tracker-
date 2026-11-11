/**
 * Projeto pessoal: marcos com prazo e progresso.
 *
 * Progresso = marcos concluídos / total. Sem marcos, é `null` (sem dado), não 0%.
 */

export interface Milestone {
  id: string;
  title: string;
  done: boolean;
  due?: string;
}

export interface Project {
  id: string;
  name: string;
  deadline?: string;
  milestones: Milestone[];
  notes?: string;
}

export function projectProgress(project: Project): { done: number; total: number; ratio: number | null } {
  const total = project.milestones.length;
  const done = project.milestones.filter((m) => m.done).length;
  return { done, total, ratio: total ? done / total : null };
}

/** Próximo marco em aberto (o de prazo mais próximo, ou o primeiro da lista). */
export function nextMilestone(project: Project): Milestone | undefined {
  const open = project.milestones.filter((m) => !m.done);
  if (!open.length) return undefined;
  return [...open].sort((a, b) => {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  })[0];
}

/** Marcos atrasados (prazo passado e ainda não concluídos). */
export function overdueMilestones(project: Project, today: string): Milestone[] {
  return project.milestones.filter((m) => !m.done && m.due && m.due < today);
}

/** Risco simples de prazo: % do tempo consumido vs % do trabalho concluído. */
export function deadlineRisk(
  project: Project,
  start: string,
  today: string,
): { status: 'sem-prazo' | 'sem-dado' | 'no-prazo' | 'atencao' | 'atrasado'; label: string } {
  if (!project.deadline) return { status: 'sem-prazo', label: 'Sem prazo definido' };
  const progress = projectProgress(project);
  if (progress.ratio == null) return { status: 'sem-dado', label: 'Sem marcos definidos' };
  if (today > project.deadline) {
    return progress.ratio >= 1
      ? { status: 'no-prazo', label: 'Concluído' }
      : { status: 'atrasado', label: 'Prazo vencido' };
  }
  const totalDays = Math.max(1, daysBetween(start, project.deadline));
  const usedDays = Math.max(0, daysBetween(start, today));
  const timeRatio = Math.min(1, usedDays / totalDays);
  // Trabalho precisa acompanhar o tempo consumido (com 15 pontos de folga).
  if (progress.ratio + 0.15 >= timeRatio) return { status: 'no-prazo', label: 'No prazo' };
  return { status: 'atencao', label: 'Atrás do ritmo' };
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
}
