/**
 * MY PRIME — Design System
 *
 * "Emerald Obsidian" é o tema padrão. A paleta é um objeto mutável de propósito:
 * `colors` é compartilhado por 30+ arquivos via import direto, então os temas
 * funcionam trocando os valores dessas chaves em runtime. Por isso NENHUM estilo
 * crítico deve ser criado em `StyleSheet.create` com cor — `StyleSheet` congela o
 * valor no módulo. Use `useTheme()` (re-renderiza) para cor em estilo inline.
 */
import { useStore } from './lib/store';
import type { ThemeId } from './lib/types';

export type { ThemeId };

export interface Palette {
  bgPrimary: string;
  bgCard: string;
  bgElevated: string;
  bgInput: string;
  bgSubtle: string;
  green: string;
  greenNeon: string;
  red: string;
  yellow: string;
  purple: string;
  orange: string;
  blue: string;
  cyan: string;
  pink: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;
  border: string;
  borderAccent: string;
  interactive: string;
  track: string;
  black: string;
  /**
   * Acento neon (glow). Opcional: temas antigos caem no `cyan`/`green`.
   * No tema `neonBlue` é o azul elétrico #3B82F6.
   */
  neon?: string;
  /** Segundo tom do acento (gradiente do cartão de saldo). */
  neonDeep?: string;
  /** Cor de texto sobre o acento neon (contraste). */
  onNeon?: string;
  /**
   * Luz ambiente do rodapé (o "glow" da referência do Copilot). Só os temas
   * novos declaram; os antigos ficam sem, e a tela usa `accent()`.
   */
  ambient?: string;
  /** 6 tons da escala de score (heatmap / anel / waffle). */
  scale: [string, string, string, string, string, string];
}

export const THEMES: Record<ThemeId, { label: string; swatch: string; palette: Palette }> = {
  emerald: {
    label: 'Emerald Obsidian',
    swatch: '#DAF1DE',
    palette: {
      bgPrimary: '#051F20',
      bgCard: '#0B2B26',
      bgElevated: '#163832',
      bgInput: '#0A2520',
      bgSubtle: '#0A2520',
      green: '#DAF1DE',
      greenNeon: '#DAF1DE',
      red: '#E54B4B',
      yellow: '#E8A838',
      purple: '#AA66FF',
      orange: '#FF6B35',
      blue: '#235347',
      cyan: '#8EB69B',
      pink: '#C58FB5',
      textPrimary: '#FFFFFF',
      textSecondary: '#8EB69B',
      textMuted: '#5A7A6E',
      textFaint: '#2A4039',
      border: '#163832',
      borderAccent: '#235347',
      interactive: '#235347',
      track: '#163832',
      black: '#000000',
      scale: ['#051F20', '#0B2B26', '#163832', '#235347', '#8EB69B', '#DAF1DE'],
    },
  },
  golden: {
    label: 'Golden Imperial',
    swatch: '#D4AF37',
    palette: {
      bgPrimary: '#0A0A0A',
      bgCard: '#121212',
      bgElevated: '#1B1B1B',
      bgInput: '#0F0F0F',
      bgSubtle: '#0F0F0F',
      green: '#D4AF37',
      greenNeon: '#F0D36B',
      red: '#E5544B',
      yellow: '#E8B54B',
      purple: '#B08CFF',
      orange: '#FF8A4C',
      blue: '#6E8FC7',
      cyan: '#9FC4C9',
      pink: '#D08FA8',
      textPrimary: '#F5F0E1',
      textSecondary: '#A89B72',
      textMuted: '#6E6349',
      textFaint: '#3A3428',
      border: '#232323',
      borderAccent: '#3A3320',
      interactive: '#2A2A2A',
      track: '#222222',
      black: '#000000',
      scale: ['#0A0A0A', '#121212', '#1B1B1B', '#3A3320', '#A89B72', '#F0D36B'],
    },
  },
  cyberpunk: {
    label: 'Cyberpunk Attack',
    swatch: '#AA66FF',
    palette: {
      bgPrimary: '#0A0A0A',
      bgCard: '#1A1A2E',
      bgElevated: '#242440',
      bgInput: '#12121F',
      bgSubtle: '#12121F',
      green: '#00FF88',
      greenNeon: '#39FF14',
      red: '#FF4444',
      yellow: '#FFD400',
      purple: '#AA66FF',
      orange: '#FF6B35',
      blue: '#4488FF',
      cyan: '#00DDFF',
      pink: '#FF66AA',
      textPrimary: '#FFFFFF',
      textSecondary: '#9A93C4',
      textMuted: '#5E5883',
      textFaint: '#332F4D',
      border: '#262440',
      borderAccent: '#3C3566',
      interactive: '#2C2A4A',
      track: '#201E33',
      black: '#000000',
      scale: ['#0A0A0A', '#1A1A2E', '#242440', '#3C3566', '#9A93C4', '#AA66FF'],
    },
  },
  ocean: {
    label: 'Deep Ocean',
    swatch: '#00B4D8',
    palette: {
      bgPrimary: '#001D3D',
      bgCard: '#002855',
      bgElevated: '#003566',
      bgInput: '#001730',
      bgSubtle: '#001730',
      green: '#00B4D8',
      greenNeon: '#90E0EF',
      red: '#E5544B',
      yellow: '#FFC300',
      purple: '#8A7BFF',
      orange: '#FF8E3C',
      blue: '#0077B6',
      cyan: '#90E0EF',
      pink: '#F08FB8',
      textPrimary: '#FFFFFF',
      textSecondary: '#8FB6D9',
      textMuted: '#527093',
      textFaint: '#26405C',
      border: '#00305C',
      borderAccent: '#00457F',
      interactive: '#003566',
      track: '#00294F',
      black: '#000000',
      scale: ['#001D3D', '#002855', '#003566', '#0077B6', '#00B4D8', '#90E0EF'],
    },
  },
  /**
   * Dark Neon Blue Bento — inspirado em dashboard financeiro moderno.
   * Fundo #08090E, superfícies #121522, acento azul elétrico #3B82F6.
   * `bgSubtle`/`bgInput` são os "poços" (dia do calendário, barra vazia).
   */
  neonBlue: {
    label: 'Dark Neon Blue Bento',
    swatch: '#3B82F6',
    palette: {
      bgPrimary: '#08090E',
      bgCard: '#121522',
      bgElevated: '#171B2C',
      bgInput: '#0D1019',
      bgSubtle: '#0D1019',
      green: '#22D3A7',
      greenNeon: '#22D3A7',
      red: '#F26D6D',
      yellow: '#F5B33F',
      purple: '#9B8CFF',
      orange: '#FF8A5B',
      blue: '#3B82F6',
      cyan: '#2563EB',
      pink: '#E179B8',
      textPrimary: '#F5F7FF',
      textSecondary: '#9AA4C0',
      textMuted: '#5C6482',
      textFaint: '#2A3050',
      border: '#222741',
      borderAccent: '#3B82F6',
      interactive: '#3B82F6',
      track: '#1A1F33',
      black: '#000000',
      neon: '#3B82F6',
      neonDeep: '#2563EB',
      // Branco sobre #3B82F6 dá 3.68:1 (reprova AA). Texto escuro sobre a pílula
      // neon dá 5.41:1 — e ainda parece mais "elétrico" que branco.
      onNeon: '#08090E',
      scale: ['#0D1019', '#16203A', '#1B2F5C', '#22488F', '#2C64C9', '#3B82F6'],
    },
  },

  /**
   * "Soft Light Glass" — o claro translúcido da referência Management/Coders.
   *
   * É um tema CLARO: por isso `black` (a cor de texto sobre botão primário) vira
   * branco aqui. Antes dela, todo tema tinha fundo escuro e `black` era sempre
   * usado como "contraste do acento"; num tema claro isso apagaria o rótulo dos
   * botões. `onNeon` faz o mesmo papel, e `accentText()` já respeita isso.
   */
  softGlass: {
    label: 'Soft Light Glass',
    swatch: '#1C1C1F',
    palette: {
      bgPrimary: '#EBECEC',
      bgCard: 'rgba(255,255,255,0.80)',
      bgElevated: '#FFFFFF',
      bgInput: 'rgba(255,255,255,0.90)',
      bgSubtle: '#F4F5F6',
      green: '#2E7D5B',
      greenNeon: '#34C08A',
      red: '#B4453C',
      yellow: '#A8792A',
      purple: '#6157C4',
      orange: '#B96A34',
      blue: '#2F6FB0',
      cyan: '#3A7C8C',
      pink: '#B25A86',
      textPrimary: '#1C1C1F',
      textSecondary: '#5C5F63',
      textMuted: '#8A8D91',
      textFaint: '#C9CBD0',
      border: 'rgba(28,28,31,0.10)',
      borderAccent: 'rgba(28,28,31,0.22)',
      interactive: '#1C1C1F',
      track: 'rgba(28,28,31,0.08)',
      black: '#FFFFFF',
      neon: '#1C1C1F',
      neonDeep: '#3A3A3E',
      onNeon: '#FFFFFF',
      // Escala do heatmap num tema CLARO: do quase-branco ao grafite. Os tons
      // baixos precisam contrastar com o card branco, senão o dia sem registro
      // some no fundo e o mapa não mostra nada.
      scale: ['#F1F2F3', '#D3D6D9', '#AEB2B7', '#84888D', '#55585C', '#1C1C1F'],
    },
  },

  /**
   * "FITPULSE Dark Lime" — preto puro + cards grafite + verde lima.
   *
   * O acento é CLARO (#A3E635), então o texto sobre ele precisa ser escuro:
   * branco sobre lima dá 1.6:1 e some no sol. `black`/`onNeon` ficam pretos aqui.
   */
  fitPulse: {
    label: 'FITPULSE Dark Lime',
    swatch: '#A3E635',
    palette: {
      bgPrimary: '#0D0E12',
      bgCard: '#13151A',
      bgElevated: '#191C22',
      bgInput: '#0F1116',
      bgSubtle: '#1B1F26',
      green: '#A3E635',
      greenNeon: '#BEF264',
      red: '#F87171',
      yellow: '#FBBF24',
      purple: '#A78BFA',
      orange: '#FB923C',
      blue: '#60A5FA',
      cyan: '#2DD4BF',
      pink: '#F472B6',
      textPrimary: '#F4F6F2',
      textSecondary: '#A7AEB8',
      textMuted: '#6F7683',
      textFaint: '#3A404B',
      border: 'rgba(255,255,255,0.10)',
      borderAccent: 'rgba(163,230,53,0.35)',
      interactive: '#A3E635',
      track: '#22262E',
      black: '#0D0E12',
      neon: '#A3E635',
      neonDeep: '#84CC16',
      onNeon: '#0D0E12',
      scale: ['#1B1F26', '#3F4A2E', '#5C6B33', '#7C8F33', '#A3E635', '#BEF264'],
    },
  },
  /**
   * LIX — a atmosfera do Copilot. Vem DEPOIS dos outros de propósito: a
   * identidade da tela de IA é fixa (`components/Lix.tsx`), mas quem quiser o
   * app inteiro no mesmo clima escuro com luz turquesa escolhe este tema no
   * Perfil. Nenhum tema existente muda de valor.
   */
  copilot: {
    label: 'LIX Ambient',
    swatch: '#38BDF8',
    palette: {
      bgPrimary: '#070A10',
      bgCard: '#0F1520',
      bgElevated: '#151D2A',
      bgInput: '#0B111B',
      bgSubtle: '#0E141F',
      green: '#34D399',
      greenNeon: '#6EE7B7',
      red: '#F87171',
      yellow: '#FBBF24',
      purple: '#8B5CF6',
      orange: '#FB923C',
      blue: '#38BDF8',
      cyan: '#2DD4BF',
      pink: '#F472B6',
      textPrimary: '#FFFFFF',
      textSecondary: '#C2CBD8',
      textMuted: '#8A94A6',
      textFaint: '#4A5464',
      border: 'rgba(255,255,255,0.09)',
      borderAccent: 'rgba(56,189,248,0.40)',
      interactive: '#38BDF8',
      track: '#1A2331',
      black: '#05070C',
      neon: '#38BDF8',
      neonDeep: '#0EA5E9',
      onNeon: '#05070C',
      ambient: '#2DD4BF',
      scale: ['#101722', '#16324A', '#1B4E6E', '#1E7BA0', '#22A6C9', '#7EE7F5'],
    },
  },
};

/** Paleta ativa. Objeto mutável: ver comentário no topo do arquivo. */
export const colors: Palette = { ...THEMES.emerald.palette };

/** Aplica um tema (mutação in-place para os imports diretos continuarem válidos). */
export function applyTheme(id: ThemeId): void {
  const palette = THEMES[id]?.palette ?? THEMES.emerald.palette;
  // `Object.assign` sozinho deixa lixo para trás: campos opcionais que existem
  // só em alguns temas (`neon`, `neonDeep`, `onNeon`) sobreviviam à troca e o
  // tema Emerald continuava com o azul do Neon. Limpa antes de aplicar.
  for (const key of Object.keys(colors) as (keyof Palette)[]) {
    if (!(key in palette)) delete (colors as Partial<Palette>)[key];
  }
  Object.assign(colors, palette);
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && value in THEMES;
}

/**
 * Cor ativa + re-render por mudança de tema.
 *
 * Todo componente que usa cor em estilo inline deve chamar isto: assim a troca de
 * tema no Perfil reflete na hora, sem reiniciar o app.
 */
export function useTheme(): Palette {
  // Seletor fino: só re-renderiza quando o id do tema muda.
  useStore((s) => s.settings.theme);
  return colors;
}

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
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

/** Tipografia — escala do briefing (H1 32, H2 22, H3 18, body 15, caption 12, micro 10). */
export const type = {
  h1: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  h2: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.2 },
  h3: { fontSize: 18, fontWeight: '600' as const },
  /** Números grandes (score, streak, foco). */
  metric: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1 },
  body: { fontSize: 15, fontWeight: '400' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 10, fontWeight: '600' as const },
} as const;

/** Label uppercase de seção: 11px, bold, tracking 2px. */
export const labelStyle = {
  fontSize: 11,
  fontWeight: '700' as const,
  letterSpacing: 2,
  textTransform: 'uppercase' as const,
};

/** Paleta de áreas da vida — derivada do tema para não brigar com a paleta. */
export function areaColor(area: string): string {
  const map: Record<string, string> = {
    Treino: colors.cyan,
    Estudo: colors.purple,
    Finanças: colors.yellow,
    Leitura: colors.blue,
    Sono: colors.blue,
    Relacionamentos: colors.pink,
    Espiritualidade: colors.yellow,
    Trabalho: colors.blue,
    'Projeto Pessoal': colors.orange,
    Saúde: colors.red,
    Dieta: colors.green,
    Ayanokoji: colors.purple,
  };
  if (map[area]) return map[area];
  const fallback = [colors.cyan, colors.purple, colors.orange, colors.blue, colors.pink, colors.yellow];
  let hash = 0;
  for (let i = 0; i < area.length; i++) hash = (hash * 31 + area.charCodeAt(i)) % 9973;
  return fallback[hash % fallback.length] ?? colors.cyan;
}

/* ───────────────────────── Escala de score (6 tons) ───────────────────────── */

/**
 * Cor do score na escala Emerald: 0 / 1–3.9 / 4–5.9 / 6–7.9 / 8–9.4 / 9.5–10.
 * `null` = sem registro, que é diferente de zero.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return colors.scale[0];
  if (score <= 0) return colors.scale[0];
  if (score < 4) return colors.scale[1];
  if (score < 6) return colors.scale[2];
  if (score < 8) return colors.scale[3];
  if (score < 9.5) return colors.scale[4];
  return colors.scale[5];
}

export function scoreLabel(score: number, done = 1): string {
  // Regra 2: "Domínio" sem nenhuma tarefa entregue seria elogio vazio.
  if (done === 0) return score < 4 ? 'Zona de risco' : 'Sem entrega registrada';
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

/** Mindset do dia — rotaciona pela data, sem repetir em dias seguidos. */
const MINDSETS = [
  'Disciplina é escolher o que você quer mais, não o que quer agora.',
  'O sistema trabalha. O humor só atrapalha.',
  'Ninguém vai fazer o que você prometeu por você.',
  'Consistência medíocre vence intensidade intermitente.',
  'Faça o mínimo hoje. Só não faça nada.',
  'Você não precisa de motivação. Precisa de sequência.',
  'O padrão que você repete é o padrão que você vira.',
  'Foco é dizer não para quase tudo.',
  'Registrar já é metade da correção.',
];

export function mindsetOfDay(dateKey: string): string {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) hash = (hash * 31 + dateKey.charCodeAt(i)) % 100003;
  return MINDSETS[hash % MINDSETS.length] ?? MINDSETS[0]!;
}

/* ─────────────────────── Acento neon (glow) ─────────────────────── */

/**
 * Cor de acento do tema ativo. Usa `neon` quando existe e cai no `cyan` nos
 * temas antigos — assim a tela de Finanças ganha o azul elétrico no tema novo
 * sem mudar de cara nos outros quatro.
 */
export function accent(): string {
  return colors.neon ?? colors.cyan;
}

/** Acento escuro (para o fim do gradiente do cartão). */
export function accentDeep(): string {
  return colors.neonDeep ?? colors.cyan;
}

/** Texto legível sobre o acento. */
export function onAccent(): string {
  return colors.onNeon ?? colors.black;
}
