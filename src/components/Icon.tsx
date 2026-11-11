/**
 * Ícones do MY PRIME.
 *
 * Regra do briefing: nada de emoji gigante no lugar de ícone. Os emojis ficam só
 * em texto corrido (modo do dia, badges de constância); toda a iconografia de UI
 * passa por aqui, com Lucide e stroke fino.
 */
import React from 'react';
import {
  Activity,
  ArrowRight,
  BedDouble,
  Bell,
  BookOpen,
  Brain,
  BrainCircuit,
  CalendarDays,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Download,
  Droplet,
  Dumbbell,
  Utensils,
  Flag,
  Flame,
  Gauge,
  House,
  Layers,
  Link2,
  Lock,
  Moon,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scale,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Upload,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme';

/** Nome semântico → ícone. Um lugar só para trocar a iconografia. */
export const ICONS = {
  hoje: House,
  revisoes: ChartColumn,
  metas: Target,
  inteligencia: Brain,
  perfil: User,

  foco: Timer,
  tarefas: CircleCheck,
  streak: Flame,
  score: Gauge,
  semanas: CalendarDays,
  trofeu: Trophy,
  tendencia: TrendingUp,
  alerta: TriangleAlert,
  escudo: ShieldAlert,
  fuga: Lock,

  treino: Dumbbell,
  estudo: BookOpen,
  leitura: BookOpen,
  financas: Wallet,
  sono: BedDouble,
  saude: Activity,
  dieta: Utensils,
  peso: Scale,
  agua: Droplet,
  projeto: Flag,
  fila: Layers,

  calendário: CalendarDays,
  alarme: Bell,
  relogio: Clock,
  lua: Moon,
  sol: Sun,
  raio: Zap,
  brilho: Sparkles,
  cerebro: Brain,
  cerebroCircuito: BrainCircuit,
  play: Play,
  pausa: Pause,
  reiniciar: RotateCcw,
  mais: Plus,
  seta: ArrowRight,
  chevronDireita: ChevronRight,
  chevronBaixo: ChevronDown,
  fechar: X,
  baixar: Download,
  enviar: Upload,
  aparencia: Palette,
  sistema: Settings,
  vincular: Link2,
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({
  name,
  size = 18,
  color,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const t = useTheme();
  const Cmp: LucideIcon = ICONS[name] ?? Target;
  return <Cmp size={size} color={color ?? t.textSecondary} strokeWidth={strokeWidth} />;
}

/** Ícone de área da vida (usado nos cards de área e no detalhamento). */
export function areaIcon(area: string): IconName {
  const map: Record<string, IconName> = {
    Treino: 'treino',
    Estudo: 'estudo',
    Leitura: 'leitura',
    Finanças: 'financas',
    Sono: 'sono',
    Saúde: 'saude',
    Dieta: 'dieta',
    'Projeto Pessoal': 'projeto',
    Espiritualidade: 'brilho',
    Trabalho: 'tarefas',
    Relacionamentos: 'perfil',
  };
  return map[area] ?? 'metas';
}
