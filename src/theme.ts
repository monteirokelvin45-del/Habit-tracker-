/**
 * MY PRIME — Design System
 * Dark mode obrigatório. Sem light mode.
 */

export const colors = {
  bgPrimary: '#0A0A0A',
  bgCard: '#1A1A1A',
  bgElevated: '#252525',
  bgInput: '#111111',

  green: '#00FF88',
  greenNeon: '#39FF14',
  red: '#FF4444',
  yellow: '#FFAA00',
  purple: '#AA66FF',
  orange: '#FF6B35',
  blue: '#4488FF',
  cyan: '#00DDFF',
  pink: '#FF66AA',

  textPrimary: '#FFFFFF',
  textSecondary: '#888888',
  textMuted: '#555555',
  border: '#2A2A2A',
  track: '#333333',
  black: '#000000',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 20,
} as const;

export const type = {
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 22, fontWeight: '700' as const },
  h3: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '500' as const },
};

/** Paleta de áreas da vida (cores estáveis por área). */
export const AREA_COLORS: Record<string, string> = {
  Treino: colors.green,
  Estudo: colors.purple,
  Finanças: colors.yellow,
  Leitura: colors.cyan,
  Sono: colors.blue,
  Relacionamentos: colors.pink,
  Espiritualidade: '#C9A227',
  Trabalho: '#6FA8DC',
  'Projeto Pessoal': colors.orange,
  Saúde: colors.red,
  Ayanokoji: '#9B7BFF',
};

const FALLBACK_COLORS = [
  colors.green,
  colors.cyan,
  colors.purple,
  colors.orange,
  colors.blue,
  colors.pink,
  colors.yellow,
  '#C9A227',
  '#6FA8DC',
];

export function areaColor(area: string): string {
  if (AREA_COLORS[area]) return AREA_COLORS[area];
  let hash = 0;
  for (let i = 0; i < area.length; i++) hash = (hash * 31 + area.charCodeAt(i)) % 9973;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] ?? colors.green;
}

export function scoreColor(score: number): string {
  if (score < 4) return colors.red;
  if (score < 6) return colors.yellow;
  if (score < 8) return colors.green; // verde claro
  return colors.greenNeon; // verde neon (8-10)
}

export function scoreLabel(score: number): string {
  if (score < 4) return 'Zona de risco';
  if (score < 6) return 'Abaixo do padrão';
  if (score < 8) return 'Consistente';
  return 'Domínio';
}

export const MODES = {
  normal: { label: 'Normal', emoji: '🟢', color: colors.green },
  minimal: { label: 'Mínimo', emoji: '🟡', color: colors.yellow },
  attack: { label: 'Ataque', emoji: '🟣', color: colors.purple },
  recovery: { label: 'Recuperação', emoji: '🔴', color: colors.orange },
} as const;
