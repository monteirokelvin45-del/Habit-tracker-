import type { BadgeState } from './types';
import { BADGES } from './badges';

/**
 * Anúncio de conquista.
 *
 * O store já calculava `unlockedAt` desde o começo, mas nada comparava antes/depois:
 * o badge aparecia na lista de conquistas em silêncio. A recompensa existe para
 * fechar o loop, então o desbloqueio precisa ser anunciado no momento em que ocorre —
 * e nunca de novo (o `unlockedAt` é a marca de "já anunciado").
 */

export interface BadgeUnlock {
  id: string;
  emoji: string;
  name: string;
  criteria: string;
  unlockedAt: string;
}

/**
 * Badges que passaram de bloqueado para desbloqueado entre dois estados.
 * Compara por `id`; badge que já estava desbloqueado não é anunciado de novo.
 */
export function newlyUnlocked(previous: BadgeState[], next: BadgeState[]): BadgeUnlock[] {
  const was = new Set(previous.filter((b) => !!b.unlockedAt).map((b) => b.id));
  const unlocks: BadgeUnlock[] = [];
  for (const b of next) {
    if (!b.unlockedAt || was.has(b.id)) continue;
    const def = BADGES.find((d) => d.id === b.id);
    if (!def) continue; // badge de versão antiga: não anuncia o que não sabemos descrever
    unlocks.push({ id: def.id, emoji: def.emoji, name: def.name, criteria: def.criteria, unlockedAt: b.unlockedAt });
  }
  return unlocks;
}

/** Texto do anúncio (nunca elogio vazio: cita o critério que foi cumprido — regra 2). */
export function unlockMessage(unlock: BadgeUnlock): string {
  return `${unlock.name} — ${unlock.criteria.toLowerCase()}.`;
}

/** Primeiro desbloqueio da lista, para a faixa do dashboard mostrar um por vez. */
export function currentUnlock(unlocks: BadgeUnlock[]): BadgeUnlock | null {
  return unlocks.length ? unlocks[0]! : null;
}
