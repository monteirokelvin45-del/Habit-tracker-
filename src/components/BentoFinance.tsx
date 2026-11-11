/**
 * Bento Grid — peças visuais do módulo financeiro (Dark Neon Blue).
 *
 * Tudo aqui é APRESENTAÇÃO: nada calcula dinheiro nem inventa número. As props
 * chegam prontas da tela, que usa `src/lib/finance.ts`. Quando um dado não
 * existe, a peça recebe `null` e escreve "Sem dado" — nunca zero.
 *
 * Sem lib de gradiente/blur: `react-native-svg` já é dependência, então o
 * gradiente é um `<Svg>` com `<LinearGradient>` por baixo do conteúdo, e o
 * "glow" é uma sombra elíptica desenhada atrás do card. Zero dependência nova.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { formatBRL } from '../lib/date';
import { accent, accentDeep, onAccent, radius, spacing, useTheme } from '../theme';
import { Row, Txt } from './ui';

/* ─────────────────────────────── superfícies ─────────────────────────────── */

/** Card Bento: superfície escura, canto bem arredondado, borda fina. */
export function Bento({
  children,
  style,
  tone = 'plain',
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** `glow` acrescenta a borda acesa do acento. */
  tone?: 'plain' | 'glow' | 'danger';
}) {
  const t = useTheme();
  const border = tone === 'glow' ? accent() + '66' : tone === 'danger' ? t.red + '55' : t.border;
  return (
    <View
      style={[
        {
          backgroundColor: t.bgCard,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: border,
          padding: spacing.lg,
          // Profundidade sem blur nativo: sombra do próprio RN.
          shadowColor: '#000000',
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Halo neon atrás de um elemento (o "drop-shadow-[0_0_15px]" do CSS).
 * Um círculo muito transparente em camadas dá o degradê sem `blur`.
 */
export function Glow({ color, size = 120, style }: { color?: string; size?: number; style?: StyleProp<ViewStyle> }) {
  const c = color ?? accent();
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      {[0.16, 0.1, 0.06].map((o, i) => (
        <View
          key={o}
          style={{
            position: 'absolute',
            top: (size * i) / 6,
            left: (size * i) / 6,
            width: size - (size * i) / 3,
            height: size - (size * i) / 3,
            borderRadius: size,
            backgroundColor: c,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}

/** Barra de progresso fina (troco o `overflow:'hidden'` por raio no preenchimento). */
export function ThinBar({ ratio, color, height = 6 }: { ratio: number | null; color?: string; height?: number }) {
  const t = useTheme();
  const clamped = ratio == null || !Number.isFinite(ratio) ? 0 : Math.max(0, Math.min(1, ratio));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: t.track, overflow: 'hidden' }}>
      <View
        style={{
          height,
          width: `${clamped * 100}%`,
          borderRadius: height,
          backgroundColor: color ?? accent(),
        }}
      />
    </View>
  );
}

/* ───────────────────────────── cartão de saldo ───────────────────────────── */

/**
 * Cartão de crédito (visual da referência) — com um dado REAL opcional.
 *
 * O app não guarda número de cartão: `last4` vai para o armazenamento local do
 * próprio aparelho (AsyncStorage) e só os 4 últimos dígitos existem. Sem `last4`,
 * a máscara é neutra e o cartão vira só "saldo do mês" — nunca número inventado.
 */
export function BalanceCard({
  balance,
  label = 'Saldo do mês',
  caption,
  last4,
  onEditNumber,
  onCopy,
}: {
  /** `null` = sem lançamento no mês. Não vira 0. */
  balance: number | null;
  label?: string;
  caption?: string;
  /** 4 últimos dígitos (opcional, dado local do usuário). */
  last4?: string | null;
  onEditNumber?: () => void;
  onCopy?: () => void;
}) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Defs, LinearGradient, Rect, Stop } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const masked = last4 ? `•••• •••• •••• ${last4}` : '•••• •••• •••• ••••';

  return (
    <View
      style={{
        borderRadius: 26,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: accent() + '3D',
        backgroundColor: t.bgCard,
        shadowColor: accent(),
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: 8,
      }}
    >
      {/* Metade de cima: gradiente. Metade de baixo: barra escura com o número. */}
      <View style={{ height: 132 }}>
        <Svg width="100%" height="100%" style={{ position: 'absolute' }} preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="bentoBalance" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={t.bgCard} stopOpacity={1} />
              <Stop offset="0.45" stopColor={accentDeep()} stopOpacity={0.55} />
              <Stop offset="1" stopColor={accent()} stopOpacity={0.9} />
            </LinearGradient>
            <LinearGradient id="bentoFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.bgCard} stopOpacity={0} />
              <Stop offset="1" stopColor={t.bgCard} stopOpacity={0.85} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#bentoBalance)" />
          <Rect x="0" y="55" width="100" height="45" fill="url(#bentoFade)" />
        </Svg>
        <View style={{ padding: spacing.lg, gap: 6 }}>
          <Txt variant="micro" color={t.textPrimary} style={{ opacity: 0.75, letterSpacing: 0.8 }}>
            {label}
          </Txt>
          <Txt variant="h1" color="#FFFFFF" style={{ fontSize: 34, letterSpacing: -1 }}>
            {balance == null ? 'Sem dado' : formatBRL(balance)}
          </Txt>
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: t.bgSubtle,
          borderTopWidth: 1,
          borderTopColor: t.border,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Row gap={spacing.sm} style={{ alignItems: 'center', flex: 1 }}>
          {/* Chip dourado-ish do cartão (decorativo). */}
          <View
            style={{
              width: 30,
              height: 20,
              borderRadius: 5,
              borderWidth: 1,
              borderColor: accent() + '66',
              backgroundColor: accent() + '1F',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View style={{ width: 12, height: 1, backgroundColor: accent() + 'AA' }} />
            <View style={{ width: 12, height: 1, backgroundColor: accent() + 'AA', marginTop: 3 }} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="micro" color={t.textSecondary} upper={false} style={{ letterSpacing: 2, fontSize: 11 }}>
              {masked}
            </Txt>
            {caption ? (
              <Txt variant="micro" color={t.textMuted} upper={false} style={{ fontSize: 9 }}>
                {caption}
              </Txt>
            ) : null}
          </View>
        </Row>
        {onCopy || onEditNumber ? (
          <Row gap={6}>
            {onCopy ? (
              <View
                accessibilityRole="button"
                accessibilityLabel="Copiar os 4 últimos dígitos"
                onStartShouldSetResponder={() => true}
                onResponderRelease={onCopy}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  backgroundColor: accent() + '26',
                  borderWidth: 1,
                  borderColor: accent() + '55',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt variant="caption" color={accent()}>
                  ⧉
                </Txt>
              </View>
            ) : null}
            {onEditNumber ? (
              <View
                accessibilityRole="button"
                accessibilityLabel="Informar os 4 últimos dígitos do cartão"
                onStartShouldSetResponder={() => true}
                onResponderRelease={onEditNumber}
                style={{
                  height: 30,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  backgroundColor: accent(),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt variant="micro" color={onAccent()} style={{ fontSize: 9 }}>
                  {last4 ? 'trocar' : 'informar'}
                </Txt>
              </View>
            ) : null}
          </Row>
        ) : null}
      </View>
    </View>
  );
}

/* ─────────────────────── anéis concêntricos (radial) ─────────────────────── */

export interface RingDatum {
  key: string;
  label: string;
  /** 0..1. `null` quando não há base de cálculo (não desenha anel). */
  ratio: number | null;
  /** Texto do valor já formatado ("R$ 3.420" ou "Sem dado"). */
  valueText: string;
}

/**
 * Anéis concêntricos (o "Top Spend Rings").
 *
 * O raio de cada anel é fixo e a fração preenchida é o dado — isso evita o
 * gráfico mentiroso em que um anel maior parece "mais importante". A cor
 * escurece do anel externo para o interno (a mesma ideia da referência).
 */
export function BalanceRings({ rings, size = 210 }: { rings: RingDatum[]; size?: number }) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, G } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const c = size / 2;
  const ringsToDraw = rings.slice(0, 4);
  const tones = [accentDeep(), accent(), '#7FB0FF', '#BFD5FF'];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G>
        {ringsToDraw.map((r, i) => {
          // Anéis bem separados e finos, como na referência; o "rabo" sai porque
          // o arco começa no topo (rotate -90) e termina com ponta arredondada.
          const radiusPx = c - 10 - i * 17;
          const circumference = 2 * Math.PI * radiusPx;
          const filled = r.ratio == null || !Number.isFinite(r.ratio) ? 0 : Math.max(0, Math.min(1, r.ratio));
          // Sem dado: anel fica só o trilho (não inventa fração).
          return (
            <G key={r.key}>
              <Circle cx={c} cy={c} r={radiusPx} stroke={t.track} strokeWidth={3} fill="transparent" />
              {filled > 0 ? (
                <>
                  <Circle
                    cx={c}
                    cy={c}
                    r={radiusPx}
                    stroke={tones[i] ?? accent()}
                    strokeWidth={3.5}
                    fill="transparent"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference * (1 - filled)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${c} ${c})`}
                    opacity={0.95}
                  />
                  {/* Halo do arco: mesma geometria, mais largo e transparente. */}
                  <Circle
                    cx={c}
                    cy={c}
                    r={radiusPx}
                    stroke={tones[i] ?? accent()}
                    strokeWidth={9}
                    fill="transparent"
                    strokeDasharray={`${circumference}`}
                    strokeDashoffset={circumference * (1 - filled)}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${c} ${c})`}
                    opacity={0.13}
                  />
                </>
              ) : null}
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

/** Legenda dos anéis, em lista compacta (vai ao lado/embaixo do círculo). */
export function RingsLegend({ rings }: { rings: RingDatum[] }) {
  const t = useTheme();
  const tones = [accentDeep(), accent(), '#7FB0FF', '#BFD5FF'];
  return (
    <View style={{ gap: 5 }}>
      {rings.slice(0, 4).map((r, i) => (
        <Row key={`leg-${r.key}`} style={{ justifyContent: 'space-between', alignItems: 'center' }} gap={6}>
          <Row gap={5} style={{ alignItems: 'center', flex: 1 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tones[i] ?? accent() }} />
            <Txt variant="micro" color={t.textSecondary} upper={false} numberOfLines={1} style={{ fontSize: 9 }}>
              {r.label}
            </Txt>
          </Row>
          <Txt variant="micro" color={t.textPrimary} style={{ fontSize: 9 }}>
            {r.valueText}
          </Txt>
        </Row>
      ))}
    </View>
  );
}

/* ───────────────────────────── seletor semanal ───────────────────────────── */

export interface WeekDay {
  /** `YYYY-MM-DD`. */
  date: string;
  /** "SEG", "TER"... */
  weekday: string;
  /** Dia do mês, 1..31. */
  day: number;
  hasEntries: boolean;
}

export function WeekStrip({
  days,
  selected,
  onSelect,
  onOpenDay,
}: {
  days: WeekDay[];
  selected: string | null;
  onSelect: (date: string) => void;
  onOpenDay: (date: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 4, justifyContent: 'space-between' }}>
      {days.map((d) => {
        const active = d.date === selected;
        return (
          <View key={d.date} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={active ? accent() : t.textMuted} upper={false} style={{ marginBottom: 4 }}>
              {d.weekday}
            </Txt>
            <View
              accessibilityRole="button"
              accessibilityLabel={`${d.weekday} ${d.day}${d.hasEntries ? ', com lançamento' : ''}`}
              accessibilityState={{ selected: active }}
              onStartShouldSetResponder={() => true}
              onResponderRelease={() => {
                onSelect(d.date);
                onOpenDay(d.date);
              }}
              style={{
                width: active ? 38 : 34,
                height: active ? 44 : 40,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active ? accent() : t.bgSubtle,
                borderWidth: 1,
                borderColor: active ? accent() : d.hasEntries ? accent() + '55' : t.border,
                shadowColor: active ? accent() : 'transparent',
                shadowOpacity: active ? 0.7 : 0,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 0 },
                elevation: active ? 5 : 0,
              }}
            >
              <Txt variant="caption" color={active ? onAccent() : t.textPrimary} style={{ fontWeight: '700' }}>
                {d.day}
              </Txt>
            </View>
            {/* Ponto = tem lançamento neste dia. Traço = nada registrado. */}
            <View
              style={{
                marginTop: 4,
                width: d.hasEntries ? 5 : 4,
                height: d.hasEntries ? 5 : 2,
                borderRadius: 4,
                backgroundColor: d.hasEntries ? (active ? accent() : t.textSecondary) : t.textFaint,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

/* ─────────────────── linha "renda x despesa" com tooltip ─────────────────── */

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  /** Um ponto por label. `null` = mês sem dado (a linha QUEBRA, não vai a zero). */
  points: (number | null)[];
}

/**
 * Gráfico de linhas multi-série com tooltip do ponto selecionado.
 *
 * `null` quebra a linha de propósito: mês sem lançamento não é "R$ 0", e ligar
 * os pontos fingiria continuidade que o dado não tem (Regra 1).
 */
export function IncomeOutcomeChart({
  labels,
  series,
  height = 130,
  formatValue,
  selectedIndex,
  onSelectIndex,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue: (v: number) => string;
  selectedIndex: number | null;
  onSelectIndex: (i: number | null) => void;
}) {
  const t = useTheme();
  const Svg = require('react-native-svg').default as React.ComponentType<Record<string, unknown>>;
  const { Circle, Line, Path, G, Text: SvgText } = require('react-native-svg') as Record<string, React.ComponentType<Record<string, unknown>>>;
  const width = 340;
  const padX = 12;
  const padTop = 16;
  const padBottom = 20;
  const innerW = width - padX * 2;
  const innerH = height - padTop - padBottom;

  const values = series.flatMap((s) => s.points.filter((p): p is number => p != null));
  const max = values.length ? Math.max(...values) : 0;
  const n = Math.max(labels.length, 2);
  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padTop + innerH - (max <= 0 ? 0 : (v / max) * innerH);

  const pathOf = (points: (number | null)[]) => {
    let d = '';
    let open = false;
    points.forEach((p, i) => {
      if (p == null) {
        open = false;
        return;
      }
      d += `${open ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p).toFixed(1)} `;
      open = true;
    });
    return d.trim();
  };

  const pick = (x: number) => {
    if (!labels.length) return;
    const rel = (x - padX) / Math.max(1, innerW);
    const idx = Math.round(rel * (labels.length - 1));
    onSelectIndex(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  const tip = selectedIndex != null ? labels[selectedIndex] : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View
        style={{ height }}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
        onResponderMove={(e) => pick(e.nativeEvent.locationX)}
      >
        <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
          <G>
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={padX}
                x2={width - padX}
                y1={padTop + innerH * f}
                y2={padTop + innerH * f}
                stroke={t.border}
                strokeWidth={1}
              />
            ))}
            {selectedIndex != null ? (
              <Line
                x1={xOf(selectedIndex)}
                x2={xOf(selectedIndex)}
                y1={padTop}
                y2={padTop + innerH}
                stroke={accent() + '66'}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
            {series.map((s) => (
              <Path key={`p-${s.key}`} d={pathOf(s.points)} stroke={s.color} strokeWidth={2.5} fill="none" />
            ))}
            {series.map((s) =>
              s.points.map((p, i) =>
                p == null ? null : (
                  <Circle
                    key={`${s.key}-${i}`}
                    cx={xOf(i)}
                    cy={yOf(p)}
                    r={selectedIndex === i ? 4 : 2.4}
                    fill={selectedIndex === i ? t.bgCard : s.color}
                    stroke={s.color}
                    strokeWidth={selectedIndex === i ? 2.5 : 0}
                  />
                ),
              ),
            )}
            {labels.map((l, i) =>
              i % Math.max(1, Math.ceil(labels.length / 5)) === 0 ? (
                <SvgText key={`l-${i}`} x={xOf(i)} y={height - 4} fill={t.textMuted} fontSize={8} textAnchor="middle">
                  {l}
                </SvgText>
              ) : null,
            )}
          </G>
        </Svg>
      </View>

      {/* Tooltip como bloco de texto: `SvgText` dentro de card pequeno estoura. */}
      <View style={{ minHeight: 34, justifyContent: 'center' }}>
        {selectedIndex == null || tip == null ? (
          <Txt variant="micro" color={t.textMuted}>
            Toque no gráfico para ver o valor do mês.
          </Txt>
        ) : (
          <View
            style={{
              backgroundColor: t.bgSubtle,
              borderWidth: 1,
              borderColor: accent() + '55',
              borderRadius: 12,
              paddingVertical: 6,
              paddingHorizontal: spacing.sm,
              gap: 2,
            }}
          >
            <Txt variant="micro" color={t.textSecondary} upper={false}>
              {tip}
            </Txt>
            {series.map((s) => (
              <Row key={`tip-${s.key}`} gap={6} style={{ alignItems: 'center' }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
                <Txt variant="micro" color={t.textPrimary} upper={false}>
                  {s.label}: {s.points[selectedIndex] == null ? 'Sem dado' : formatValue(s.points[selectedIndex] as number)}
                </Txt>
              </Row>
            ))}
          </View>
        )}
      </View>

      <Row gap={spacing.md} style={{ flexWrap: 'wrap' }}>
        {series.map((s) => (
          <Row key={`leg-${s.key}`} gap={4} style={{ alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 3, backgroundColor: s.color }} />
            <Txt variant="micro" color={t.textSecondary} upper={false}>
              {s.label}
            </Txt>
          </Row>
        ))}
      </Row>
    </View>
  );
}

/* ──────────────────────── barras de renda (12 meses) ──────────────────────── */

/**
 * Barras verticais finas por mês. Mês sem dado fica com um traço vazio — não
 * com uma barra de altura mínima que pareceria "quase zero".
 */
export function IncomeBars({
  data,
  height = 92,
  highlighted,
  onSelect,
}: {
  data: { month: string; value: number | null }[];
  height?: number;
  highlighted?: string | null;
  onSelect?: (month: string) => void;
}) {
  const t = useTheme();
  const values = data.map((d) => d.value).filter((v): v is number => v != null);
  const max = values.length ? Math.max(...values) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 4 }}>
      {data.map((d) => {
        const isOn = highlighted === d.month;
        // Barra ESTRITA: só meses com lançamento desenham barra. Mês vazio fica
        // como traço no chão — nada de barra mínima que pareça "quase zero".
        const h = d.value == null || max <= 0 ? 2 : Math.max(6, (d.value / max) * height);
        return (
          <View key={d.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            <View
              accessibilityRole={onSelect ? 'button' : undefined}
              accessibilityLabel={`${d.month}: ${d.value == null ? 'sem lançamento' : formatBRL(d.value)}`}
              onStartShouldSetResponder={onSelect ? () => true : undefined}
              onResponderRelease={onSelect ? () => onSelect(d.month) : undefined}
              style={{ width: '100%', alignItems: 'center', justifyContent: 'flex-end' }}
            >
              <View
                style={{
                  width: 7,
                  height: h,
                  borderRadius: 4,
                  backgroundColor: d.value == null ? t.track : isOn ? accent() : accentDeep(),
                  shadowColor: isOn ? accent() : 'transparent',
                  shadowOpacity: isOn ? 0.9 : 0,
                  shadowRadius: 9,
                  shadowOffset: { width: 0, height: 0 },
                  elevation: isOn ? 5 : 0,
                }}
              />
            </View>
            <Txt variant="micro" color={isOn ? accent() : t.textMuted} upper={false} style={{ marginTop: 4, fontSize: 7 }}>
              {d.month}
            </Txt>
          </View>
        );
      })}
    </View>
  );
}

/* ───────────────────────────── linha de atividade ───────────────────────────── */

/** Uma transação da lista "Recent Activity". */
export function ActivityRow({
  title,
  subtitle,
  amountText,
  amountColor,
  badge,
  onPress,
  right,
}: {
  title: string;
  subtitle: string;
  amountText: string;
  amountColor: string;
  badge?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityRole={onPress ? 'button' : undefined}
      onStartShouldSetResponder={onPress ? () => true : undefined}
      onResponderRelease={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: t.bgSubtle,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: t.border,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        gap: spacing.sm,
      }}
    >
      <Row gap={spacing.sm} style={{ flex: 1, alignItems: 'center' }}>
        {/* "Foto": inicial do rótulo dentro do círculo neon — sem imagem fake. */}
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: accent() + '26',
            borderWidth: 1,
            borderColor: accent() + '55',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt variant="caption" color={accent()} style={{ fontWeight: '700' }}>
            {title.slice(0, 1).toUpperCase()}
          </Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="caption" color={t.textPrimary} numberOfLines={1}>
            {title}
          </Txt>
          <Txt variant="micro" color={t.textMuted} numberOfLines={1}>
            {subtitle}
          </Txt>
        </View>
      </Row>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Txt variant="caption" color={amountColor} style={{ fontWeight: '700' }}>
          {amountText}
        </Txt>
        {badge ? (
          <View
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: radius.pill,
              backgroundColor: accent() + '22',
              borderWidth: 1,
              borderColor: accent() + '44',
            }}
          >
            <Txt variant="micro" color={accent()} style={{ fontSize: 8 }}>
              {badge}
            </Txt>
          </View>
        ) : null}
        {right}
      </View>
    </View>
  );
}
