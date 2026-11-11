/**
 * "iDraft Soft UI" — peças do módulo de Estudos.
 *
 * Paleta PRÓPRIA, fixa e monocromática (cinza fumê + branco + grafite). Não usa
 * `colors` do tema: este módulo tem identidade visual própria, como na
 * referência. Por isso tudo aqui é estilo explícito, sem depender do tema ativo.
 *
 * Regra que vale em todas as peças: `null` escreve "Sem dado". Nada de 0,
 * nada de barra de exemplo, nada de anel cheio sem base de cálculo.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { formatBRL } from '../lib/date';
import { Txt } from './ui';

export const SOFT = {
  bg: '#F3F4F6',
  white: '#FFFFFF',
  ink: '#141416',
  inkSoft: '#2A2A2E',
  body: '#55555C',
  muted: '#8E8E96',
  line: '#E7E8EB',
  lineStrong: '#D9DAE0',
  chip: '#F4F4F6',
  danger: '#C0392B',
} as const;

/* ───────────────────────────────── cards ───────────────────────────────── */

export function SoftCard({
  children,
  style,
  dark,
  dashed,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Card preto de alto contraste (bg-zinc-900 da referência). */
  dark?: boolean;
  /** Área de "adicionar" com borda tracejada. */
  dashed?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: dark ? SOFT.ink : SOFT.white,
          borderRadius: 24,
          padding: 16,
          borderWidth: 1,
          borderColor: dashed ? SOFT.lineStrong : dark ? SOFT.ink : SOFT.line,
          borderStyle: dashed ? 'dashed' : 'solid',
          shadowColor: '#101014',
          shadowOpacity: dark ? 0.18 : 0.06,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: dark ? 5 : 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Rótulo de seção em caixa alta, discreto (o "OVERALL INFORMATION" da referência). */
export function SoftLabel({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <Txt
      variant="micro"
      upper={false}
      color={dark ? '#B9B9C0' : SOFT.muted}
      style={{ letterSpacing: 0.6, fontSize: 10, fontWeight: '600' }}
    >
      {children}
    </Txt>
  );
}

/** Botão pílula: `solid` (preto), `ghost` (branco com borda) e `icon`. */
export function SoftButton({
  label,
  onPress,
  variant = 'ghost',
  disabled,
  small,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: 'solid' | 'ghost' | 'icon';
  disabled?: boolean;
  small?: boolean;
  accessibilityLabel?: string;
}) {
  const solid = variant === 'solid';
  const icon = variant === 'icon';
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      onStartShouldSetResponder={disabled ? undefined : () => true}
      onResponderRelease={disabled ? undefined : onPress}
      style={{
        paddingHorizontal: icon ? 0 : small ? 12 : 16,
        height: icon ? 30 : small ? 30 : 38,
        width: icon ? 30 : undefined,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? SOFT.ink : SOFT.white,
        borderWidth: solid ? 0 : 1,
        borderColor: SOFT.lineStrong,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Txt
        variant="micro"
        upper={false}
        color={solid ? '#FFFFFF' : SOFT.ink}
        style={{ fontSize: icon ? 13 : small ? 11 : 12, fontWeight: '600' }}
      >
        {label}
      </Txt>
    </View>
  );
}

/* ───────────────────────────── anel de progresso ───────────────────────────── */

/**
 * Anel circular de progresso.
 *
 * `ratio == null` desenha só o trilho e escreve "Sem dado" — anel cheio sem base
 * de cálculo sugeriria meta batida que não existe.
 */
export function SoftRing({
  ratio,
  size = 64,
  label,
  caption,
  dark,
  strokeWidth,
}: {
  ratio: number | null;
  size?: number;
  label?: string;
  caption?: string;
  dark?: boolean;
  strokeWidth?: number;
}) {
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const sw = strokeWidth ?? Math.max(4, size / 14);
  const r = size / 2 - sw / 2 - 1;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  const track = dark ? '#3A3A40' : SOFT.line;
  const fill = dark ? '#FFFFFF' : SOFT.ink;

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
              strokeDasharray={`${circ}`}
              strokeDashoffset={circ * (1 - filled)}
              strokeLinecap="round"
              transform={`rotate(-90 ${c} ${c})`}
            />
          ) : null}
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Txt
          variant="caption"
          upper={false}
          color={dark ? '#FFFFFF' : SOFT.ink}
          style={{ fontSize: size > 70 ? 15 : 11, fontWeight: '700' }}
        >
          {ratio == null ? '—' : label}
        </Txt>
        {caption ? (
          <Txt variant="micro" upper={false} color={dark ? '#A8A8B0' : SOFT.muted} style={{ fontSize: 8 }}>
            {caption}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/* ───────────────────────── linha semanal (suave) ───────────────────────── */

/**
 * Linha suave de minutos por dia (a "weekly progress" da referência).
 * Dia sem registro fica `null`: a linha QUEBRA em vez de cair para zero.
 * A curva é suavizada com Catmull-Rom convertida para Bézier.
 */
export function SoftWeekLine({
  points,
  labels,
  height = 96,
  highlight,
}: {
  points: (number | null)[];
  labels: string[];
  height?: number;
  highlight?: number | null;
}) {
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G, Line, Path, Text: SvgText } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const width = 300;
  const padX = 8;
  const padTop = 10;
  const padBottom = 18;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;
  const values = points.filter((p): p is number => p != null);
  const max = values.length ? Math.max(...values) : 0;
  const n = Math.max(points.length, 2);
  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padTop + innerH - (max <= 0 ? 0 : (v / max) * innerH);

  /** Série em segmentos contínuos (null quebra). */
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

  const smooth = (seg: { i: number; v: number }[]) => {
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
      const t = 0.18;
      const c1x = xOf(p1.i) + (xOf(p2.i) - xOf(p0.i)) * t;
      const c1y = yOf(p1.v) + (yOf(p2.v) - yOf(p0.v)) * t;
      const c2x = xOf(p2.i) - (xOf(p3.i) - xOf(p1.i)) * t;
      const c2y = yOf(p2.v) - (yOf(p3.v) - yOf(p1.v)) * t;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${xOf(p2.i).toFixed(1)},${yOf(p2.v).toFixed(1)}`;
    }
    return d;
  };

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <G>
          <Line x1={padX} x2={width - padX} y1={padTop + innerH} y2={padTop + innerH} stroke={SOFT.line} strokeWidth={1} />
          {segments.map((seg, si) => (
            <Path key={`s-${si}`} d={smooth(seg)} stroke={SOFT.ink} strokeWidth={2} fill="none" strokeLinecap="round" />
          ))}
          {points.map((p, i) =>
            p == null ? null : (
              <Circle
                key={`d-${i}`}
                cx={xOf(i)}
                cy={yOf(p)}
                r={highlight === i ? 3.4 : 2}
                fill={highlight === i ? SOFT.ink : SOFT.white}
                stroke={SOFT.ink}
                strokeWidth={highlight === i ? 2 : 1.4}
              />
            ),
          )}
          {highlight != null && points[highlight] != null ? (
            <Line
              x1={xOf(highlight)}
              x2={xOf(highlight)}
              y1={padTop}
              y2={padTop + innerH}
              stroke={SOFT.lineStrong}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {labels.map((l, i) => (
            <SvgText
              key={`l-${i}`}
              x={xOf(i)}
              y={height - 4}
              fill={highlight === i ? SOFT.ink : SOFT.muted}
              fontSize={8}
              fontWeight={highlight === i ? '700' : '400'}
              textAnchor="middle"
            >
              {l}
            </SvgText>
          ))}
        </G>
      </Svg>
    </View>
  );
}

/* ───────────────────────── checklist (metas do mês) ───────────────────────── */

export function SoftCheck({
  label,
  checked,
  onToggle,
  disabled,
  trailing,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  trailing?: string;
}) {
  return (
    <View
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled: !!disabled }}
      accessibilityLabel={label}
      onStartShouldSetResponder={disabled ? undefined : () => true}
      onResponderRelease={disabled ? undefined : onToggle}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, opacity: disabled ? 0.6 : 1 }}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? SOFT.ink : SOFT.lineStrong,
          backgroundColor: checked ? SOFT.ink : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {checked ? (
          <Txt variant="micro" upper={false} color="#FFFFFF" style={{ fontSize: 10, fontWeight: '700' }}>
            ✓
          </Txt>
        ) : null}
      </View>
      <Txt
        variant="caption"
        upper={false}
        color={checked ? SOFT.muted : SOFT.ink}
        style={{ flex: 1, fontSize: 12, textDecorationLine: checked ? 'line-through' : 'none' }}
      >
        {label}
      </Txt>
      {trailing ? (
        <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9 }}>
          {trailing}
        </Txt>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── post-it "em andamento" ─────────────────────────── */

/**
 * Card branco flutuante (post-it). O menu de 3 pontos abre as ações reais:
 * fixar (pin), editar e excluir — nada de menu decorativo.
 */
export function SoftNote({
  title,
  subtitle,
  meta,
  pinned,
  onMenu,
  onPress,
}: {
  title: string;
  subtitle: string;
  meta?: string;
  pinned?: boolean;
  onMenu: () => void;
  onPress?: () => void;
}) {
  return (
    <SoftCard style={{ flex: 1, minHeight: 132, padding: 14, transform: [{ rotate: pinned ? '0deg' : '-0.6deg' }] }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 8,
            backgroundColor: SOFT.chip,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt variant="micro" upper={false} color={SOFT.ink}>
            {pinned ? '📌' : '📄'}
          </Txt>
        </View>
        <View
          accessibilityRole="button"
          accessibilityLabel={`Opções de ${title}`}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onMenu}
          style={{ paddingHorizontal: 6, paddingVertical: 2 }}
        >
          <Txt variant="caption" upper={false} color={SOFT.muted} style={{ fontSize: 14 }}>
            ⋯
          </Txt>
        </View>
      </View>
      <View
        accessibilityRole={onPress ? 'button' : undefined}
        onStartShouldSetResponder={onPress ? () => true : undefined}
        onResponderRelease={onPress}
        style={{ marginTop: 8, flex: 1 }}
      >
        <Txt variant="caption" upper={false} color={SOFT.ink} style={{ fontSize: 13, fontWeight: '700' }} numberOfLines={2}>
          {title}
        </Txt>
        <Txt variant="micro" upper={false} color={SOFT.muted} style={{ fontSize: 9, marginTop: 2 }} numberOfLines={2}>
          {subtitle}
        </Txt>
      </View>
      {meta ? (
        <Txt variant="micro" upper={false} color={SOFT.body} style={{ fontSize: 9, marginTop: 6 }}>
          {meta}
        </Txt>
      ) : null}
    </SoftCard>
  );
}

/* ───────────────────────── linha de matéria (ranking) ───────────────────────── */

export function SoftStat({ value, label, unit }: { value: string; label: string; unit?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Txt variant="h2" upper={false} color="#FFFFFF" style={{ fontSize: 22, fontWeight: '700' }}>
        {value}
        {unit ? (
          <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 10 }}>
            {' '}
            {unit}
          </Txt>
        ) : null}
      </Txt>
      <Txt variant="micro" upper={false} color="#B9B9C0" style={{ fontSize: 9 }} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** Valor monetário (usado no relatório/resumo quando houver custo). */
export function softMoney(v: number | null): string {
  return v == null ? 'Sem dado' : formatBRL(v);
}
