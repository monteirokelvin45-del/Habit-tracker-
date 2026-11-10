/** Gera IDs locais estáveis (sem dependência de crypto nativo). */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
