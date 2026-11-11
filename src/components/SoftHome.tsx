/**
 * "Soft Light Glass" — peças da Tela Principal (Home Dashboard).
 *
 * Referência: "Management / Coders" (soft light + glassmorphism, cards brancos
 * translúcidos misturados com cards pretos de destaque).
 *
 * Diferente de `SoftStudy`, este módulo NÃO tem paleta fixa: ele acompanha o tema
 * ativo, que é justamente o que o tema `softGlass` foi criado para vestir. As
 * peças leem `useTheme()` e por isso trocam de cara junto com o resto do app.
 *
 * Regra que vale em todas as peças: `null` escreve "Sem dado" (ou desenha só o
 * trilho). Nada de 0, nada de barra de exemplo, nada de anel cheio sem base.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { areaColor, radius, spacing, useTheme } from '../theme';
import { Txt } from './ui';

export const GLASS = {
  /** Preto de destaque da referência (bg-zinc-900). */
  ink: '#18181B',
  inkSoft: '#232327',
  line: 'rgba(28,28,31,0.08)',
  white: '#FFFFFF',
  /** Texto sobre card preto. */
  onInk: '#F5F5F6',
  onInkSoft: '#A1A1A8',
} as const;

/* ───────────────────────────── card de vidro ───────────────────────────── */

/**
 * Card branco translúcido. O "blur" da referência é aproximado: nem `backdrop-blur`
 * nem `expo-blur` existem aqui, então o vidro é feito com fundo semitransparente
 * + borda fina + sombra suave. Sobre o fundo cinza o resultado é o mesmo véu.
 */
export function GlassCard({
  children,
  style,
  dark,
  strong,
  padding = spacing.lg,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Card preto de destaque (o "File Preview"/"Team" da referência). */
  dark?: boolean;
  /** Branco mais opaco (para leitura densa). */
  strong?: boolean;
  padding?: number;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          borderRadius: 26,
          padding,
          borderWidth: 1,
          backgroundColor: dark ? GLASS.ink : strong ? 'rgba(255,255,255,0.94)' : t.bgCard,
          borderColor: dark ? 'rgba(255,255,255,0.08)' : t.border,
          shadowColor: '#101014',
          shadowOpacity: dark ? 0.22 : 0.07,
          shadowRadius: dark ? 22 : 16,
          shadowOffset: { width: 0, height: dark ? 12 : 8 },
          elevation: dark ? 6 : 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rótulo de seção (micro, espaçado) com contraste correto no card escuro. */
export function GlassLabel({
  children,
  dark,
  style,
}: {
  children: React.ReactNode;
  dark?: boolean;
  style?: StyleProp<{ color?: string }>;
}) {
  const t = useTheme();
  return (
    <Txt
      variant="micro"
      upper={false}
      color={dark ? GLASS.onInkSoft : t.textMuted}
      style={[{ fontSize: 10, letterSpacing: 1.4, fontWeight: '600' }, style as never]}
    >
      {children}
    </Txt>
  );
}

/** Pílula/botão do header (Busca, Notificação, Perfil, + Criar). */
export function GlassChip({
  label,
  onPress,
  active,
  dark,
  round,
  small,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  active?: boolean;
  dark?: boolean;
  /** Botão redondo (só ícone). */
  round?: boolean;
  /** Pílula compacta (dentro de card, ao lado de texto pequeno). */
  small?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const t = useTheme();
  const bg = dark ? GLASS.ink : active ? GLASS.ink : 'rgba(255,255,255,0.82)';
  const fg = dark || active ? GLASS.white : t.textPrimary;
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!active, disabled: !!disabled }}
      onStartShouldSetResponder={disabled ? undefined : () => true}
      onResponderRelease={disabled ? undefined : onPress}
      style={{
        height: round ? 34 : small ? 26 : 32,
        width: round ? 34 : undefined,
        paddingHorizontal: round ? 0 : small ? 10 : 14,
        borderRadius: radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: dark || active ? 0 : 1,
        borderColor: t.border,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Txt
        variant="micro"
        upper={false}
        color={fg}
        style={{ fontSize: small ? 10 : 11, fontWeight: '600' }}
        numberOfLines={1}
      >
        {label}
      </Txt>
    </View>
  );
}

/* ─────────────────────────── anel (hero e áreas) ─────────────────────────── */

/**
 * Anel de progresso. `ratio == null` desenha só o trilho e escreve "—": anel
 * cheio sem base de cálculo sugeriria meta batida que não existe.
 */
export function GlassRing({
  ratio,
  size = 96,
  label,
  caption,
  dark,
  accentColor,
  gapDeg = 0,
}: {
  ratio: number | null;
  size?: number;
  label?: string;
  caption?: string;
  dark?: boolean;
  /** Cor do arco (nas áreas). Sem ela, usa o contraste do card. */
  accentColor?: string;
  /** Vão entre trilho e arco, em graus (o anel duplo da referência). */
  gapDeg?: number;
}) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const sw = Math.max(4, size / 16);
  const r = size / 2 - sw / 2 - 1;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  const track = dark ? 'rgba(255,255,255,0.14)' : 'rgba(28,28,31,0.10)';
  const fill = accentColor ?? (dark ? GLASS.white : t.textPrimary);
  // O vão é um dash gap: arco curto o bastante para deixar respiro sem sumir.
  const dash = gapDeg > 0 ? `${(circ * filled * (1 - gapDeg / 360)).toFixed(1)} ${circ.toFixed(1)}` : `${circ}`;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <G>
          <Circle cx={c} cy={c} r={r} stroke={track} strokeWidth={sw} fill="transparent" />
          {filled > 0 ? (
            <Circle
              cx={c}
              cy={c}
              r={r}
              stroke={fill}
              strokeWidth={sw}
              fill="transparent"
              strokeDasharray={dash}
              strokeDashoffset={gapDeg > 0 ? 0 : circ * (1 - filled)}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
            />
          ) : null}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Txt
          variant="body"
          upper={false}
          color={dark ? GLASS.white : t.textPrimary}
          style={{ fontSize: size > 90 ? 19 : 12, fontWeight: '800', letterSpacing: -0.5 }}
        >
          {ratio == null ? '—' : label}
        </Txt>
        {caption ? (
          <Txt
            variant="micro"
            upper={false}
            color={dark ? GLASS.onInkSoft : t.textMuted}
            style={{ fontSize: 8.5, letterSpacing: 0.4 }}
          >
            {caption}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────────── linha suave (micro-gráfico) ───────────────────────── */

/**
 * Linha suavizada (Catmull-Rom → Bézier). `null` QUEBRA a série: dia sem
 * registro não pode virar zero, senão a curva inventa um vale que não existiu.
 */
export function SmoothLine({
  points,
  height = 56,
  stroke,
  fill,
  highlight,
}: {
  points: (number | null)[];
  height?: number;
  stroke?: string;
  /** Quando definido, preenche a área sob a linha (o "area chart" da referência). */
  fill?: string;
  highlight?: number | null;
}) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G, Path } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const width = 300;
  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const values = points.filter((p): p is number => p != null);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  const span = max - min || 1;
  const n = Math.max(points.length, 2);
  const xOf = (i: number) => pad + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => pad + innerH - ((v - min) / span) * innerH;

  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p == null) {
      if (cur.length) segments.push(cur);
      cur = [];
      return;
    }
    cur.push({ i, v: p });
  });
  if (cur.length) segments.push(cur);

  const smooth = (seg: { i: number; v: number }[], close: boolean) => {
    if (!seg.length) return '';
    const amp = Math.max(2, (yOf(min) - yOf(max)) * 0.016);
    if (seg.length === 1) {
      const p = seg[0]!;
      return `M${xOf(p.i)},${yOf(p.v)} L${xOf(p.i) + 0.1},${yOf(p.v)}`;
    }
    let d = `M${xOf(seg[0]!.i)},${yOf(seg[0]!.v)}`;
    for (let k = 0; k < seg.length - 1; k++) {
      const p0 = seg[Math.max(0, k - 1)]!;
      const p1 = seg[k]!;
      const p2 = seg[k + 1]!;
      const p3 = seg[Math.min(seg.length - 1, k + 2)]!;
      const t2 = 0.19;
      const c1x = xOf(p1.i) + (xOf(p2.i) - xOf(p0.i)) * t2;
      const c1y = yOf(p1.v) + (yOf(p2.v) - yOf(p0.v)) * t2;
      const c2x = xOf(p2.i) - (xOf(p3.i) - xOf(p1.i)) * t2;
      const c2y = yOf(p2.v) - (yOf(p3.v) - yOf(p1.v)) * t2;
      void amp;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${xOf(p2.i).toFixed(1)},${yOf(p2.v).toFixed(1)}`;
    }
    if (close) {
      const last = seg[seg.length - 1]!;
      d += ` L${xOf(last.i).toFixed(1)},${(height - pad).toFixed(1)} L${xOf(seg[0]!.i).toFixed(1)},${(height - pad).toFixed(1)} Z`;
    }
    return d;
  };

  const line = stroke ?? t.textPrimary;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <G>
        {fill
          ? segments.map((seg, si) => <Path key={`f-${si}`} d={smooth(seg, true)} fill={fill} stroke="none" />)
          : null}
        {segments.map((seg, si) => (
          <Path key={`p-${si}`} d={smooth(seg, false)} stroke={line} strokeWidth={2} fill="none" strokeLinecap="round" />
        ))}
        {highlight != null && points[highlight] != null ? (
          <Circle
            cx={xOf(highlight)}
            cy={yOf(points[highlight] as number)}
            r={3.2}
            fill={line}
            stroke={fill ? GLASS.white : 'none'}
            strokeWidth={1.5}
          />
        ) : null}
      </G>
    </Svg>
  );
}

/* ────────────────────────── barra fina de progresso ────────────────────────── */

/** Barra de progresso. `ratio == null` fica oca (sem preenchimento inventado). */
export function GlassBar({
  ratio,
  color,
  height = 6,
  track,
}: {
  ratio: number | null;
  color?: string;
  height?: number;
  track?: string;
}) {
  const t = useTheme();
  const pct = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: ratio == null ? undefined : Math.round(pct * 100) }}
      style={{ height, borderRadius: height, backgroundColor: track ?? 'rgba(255,255,255,0.16)', overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height,
          backgroundColor: color ?? (t.textPrimary || GLASS.white),
        }}
      />
    </View>
  );
}

/* ───────────────────────────── pílula de área ───────────────────────────── */

/** Bolinha com a cor da área — o "avatar" de categoria da referência. */
export function AreaDot({ area, size = 20 }: { area: string; size?: number }) {
  const c = areaColor(area);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.85)',
      }}
    />
  );
}
