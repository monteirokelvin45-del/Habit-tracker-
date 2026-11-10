import React from 'react';
import { StyleSheet, View } from 'react-native';
import { areaColor, colors, scoreColor, spacing } from '../theme';
import { Muted, Txt } from './ui';

/* ─────────────────────────── Heatmap ─────────────────────────── */

export function Heatmap({
  data,
  columns = 7,
  cell = 30,
}: {
  data: { date: string; score: number | null }[];
  columns?: number;
  cell?: number;
}) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {data.map((d) => (
        <View
          key={d.date}
          style={{
            width: cell,
            height: cell,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: d.score == null ? colors.border : scoreColor(d.score) + '88',
            backgroundColor: d.score == null ? colors.bgPrimary : scoreColor(d.score) + (d.score >= 6 ? 'AA' : '66'),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Txt variant="micro" color={d.score == null ? colors.textMuted : colors.black} style={{ fontSize: 9 }}>
            {d.date.slice(8, 10)}
          </Txt>
        </View>
      ))}
      {data.length % columns === 0 && data.length > 0 ? null : null}
    </View>
  );
}

/* ─────────────────────────── Bar chart ─────────────────────────── */

export function BarChart({
  data,
  max = 10,
  height = 130,
  colorFor,
  showValues = true,
}: {
  data: { label: string; value: number | null }[];
  max?: number;
  height?: number;
  colorFor?: (value: number, index: number) => string;
  showValues?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
        {data.map((d, i) => {
          const v = d.value;
          const h = v == null ? 3 : Math.max(4, (Math.min(v, max) / max) * height);
          const color = v == null ? colors.track : colorFor ? colorFor(v, i) : scoreColor(v);
          return (
            <View key={`${d.label}-${i}`} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
              {showValues && v != null ? (
                <Txt variant="micro" color={colors.textSecondary} style={{ fontSize: 9 }}>
                  {Math.round(v * 10) / 10}
                </Txt>
              ) : null}
              <View style={{ width: '100%', height: h, borderRadius: 4, backgroundColor: color }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {data.map((d, i) => (
          <View key={`${d.label}-l-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>
              {d.label}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────── Line chart ─────────────────────────── */

export function LineChart({
  series,
  labels,
  max = 10,
  height = 160,
  goal,
}: {
  series: { name: string; color: string; points: (number | null)[] }[];
  labels: string[];
  max?: number;
  height?: number;
  goal?: number;
}) {
  const Svg = require('react-native-svg').default as React.ComponentType<any>;
  const { Path, Line, Circle, Text: SvgText, G } = require('react-native-svg') as any;
  const width = 320;
  const padX = 26;
  const padY = 12;
  const innerW = width - padX;
  const innerH = height - padY * 2;
  const n = Math.max(labels.length, 2);

  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padY + innerH - (Math.max(0, Math.min(max, v)) / max) * innerH;

  const pathFor = (points: (number | null)[]) => {
    let d = '';
    let started = false;
    points.forEach((p, i) => {
      if (p == null) {
        started = false;
        return;
      }
      d += `${started ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  };

  return (
    <View style={{ gap: 8 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <G>
          {[0, 2.5, 5, 7.5, 10].map((g) => (
            <Line key={g} x1={padX} x2={width} y1={yOf(g)} y2={yOf(g)} stroke={colors.border} strokeWidth={1} />
          ))}
          {goal != null ? (
            <Line x1={padX} x2={width} y1={yOf(goal)} y2={yOf(goal)} stroke={colors.green} strokeWidth={1} strokeDasharray="4 4" />
          ) : null}
          {series.map((s) => (
            <Path key={`p-${s.name}`} d={pathFor(s.points)} stroke={s.color} strokeWidth={2} fill="none" />
          ))}
          {series.map((s) =>
            s.points.map((p, i) =>
              p == null ? null : <Circle key={`${s.name}-${i}`} cx={xOf(i)} cy={yOf(p)} r={2.2} fill={s.color} />,
            ),
          )}
          {labels.map((l, i) =>
            i % Math.ceil(labels.length / 6) === 0 ? (
              <SvgText key={`l-${i}`} x={xOf(i)} y={height - 1} fill={colors.textMuted} fontSize={8} textAnchor="middle">
                {l}
              </SvgText>
            ) : null,
          )}
        </G>
      </Svg>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {series.map((s) => (
          <View key={`leg-${s.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
            <Txt variant="micro" color={colors.textSecondary}>{s.name}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────── Radar chart ─────────────────────────── */

export function RadarChart({
  data,
  size = 260,
  max = 10,
  overlay,
  overlayColor = colors.purple,
}: {
  data: { label: string; value: number | null; color?: string }[];
  size?: number;
  max?: number;
  overlay?: { label: string; value: number | null }[];
  overlayColor?: string;
}) {
  const Svg = require('react-native-svg').default as React.ComponentType<any>;
  const { Polygon, Line, Circle, Text: SvgText, G } = require('react-native-svg') as any;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = Math.max(3, data.length);

  const pointFor = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (Math.max(0, Math.min(max, value)) / max) * r;
    return { x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr };
  };

  const poly = (values: (number | null)[]) =>
    values
      .map((v, i) => {
        const p = pointFor(i, v ?? 0);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Polygon
              key={f}
              points={data.map((_, i) => {
                const p = pointFor(i, max * f);
                return `${p.x},${p.y}`;
              }).join(' ')}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
            />
          ))}
          {data.map((_, i) => {
            const p = pointFor(i, max);
            return <Line key={`axis-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colors.border} strokeWidth={1} />;
          })}
          {overlay ? (
            <Polygon points={poly(overlay.map((o) => o.value))} stroke={overlayColor} strokeWidth={1} strokeDasharray="4 3" fill={overlayColor + '22'} />
          ) : null}
          <Polygon points={poly(data.map((d) => d.value))} stroke={colors.green} strokeWidth={2} fill={colors.green + '33'} />
          {data.map((d, i) => {
            const p = pointFor(i, d.value ?? 0);
            return <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3} fill={d.color ?? colors.green} />;
          })}
          {data.map((d, i) => {
            const p = pointFor(i, max * 1.16);
            return (
              <SvgText
                key={`lb-${i}`}
                x={p.x}
                y={p.y}
                fill={colors.textSecondary}
                fontSize={9}
                textAnchor={p.x > cx + 6 ? 'start' : p.x < cx - 6 ? 'end' : 'middle'}
              >
                {d.label}
              </SvgText>
            );
          })}
        </G>
      </Svg>
      {overlay ? (
        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />
            <Muted>Semana atual</Muted>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: overlayColor }} />
            <Muted>Semana anterior</Muted>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/* ─────────────────────────── Pie / donut ─────────────────────────── */

export function DonutChart({
  data,
  size = 180,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const Svg = require('react-native-svg').default as React.ComponentType<any>;
  const { Circle, G, Text: SvgText } = require('react-native-svg') as any;
  const total = data.reduce((a, b) => a + b.value, 0);
  const stroke = 22;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  if (total <= 0) {
    return <Muted>Sem dado para este período.</Muted>;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
          {data.map((d) => {
            const fraction = d.value / total;
            const dash = fraction * circumference;
            const el = (
              <Circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={d.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </G>
        <SvgText x={size / 2} y={size / 2} fill={colors.textPrimary} fontSize={13} textAnchor="middle">
          R$ {Math.round(total)}
        </SvgText>
      </Svg>
      <View style={{ gap: 4, flex: 1, minWidth: 130 }}>
        {data.map((d) => (
          <View key={d.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: d.color }} />
              <Txt variant="micro" color={colors.textSecondary}>{d.label}</Txt>
            </View>
            <Txt variant="micro" color={colors.textPrimary}>
              {Math.round((d.value / total) * 100)}%
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────── Grouped bars ─────────────────────────── */

export function GroupedBars({
  data,
  height = 140,
}: {
  data: { label: string; a: number; b: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.a, d.b]));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 10 }}>
        {data.map((d) => (
          <View key={d.label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', flexDirection: 'row', gap: 3 }}>
            <View style={{ flex: 1, height: Math.max(3, (d.a / max) * height), backgroundColor: colors.green, borderRadius: 3 }} />
            <View style={{ flex: 1, height: Math.max(3, (d.b / max) * height), backgroundColor: colors.red, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {data.map((d) => (
          <View key={`lb-${d.label}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>{d.label}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green }} />
          <Muted>Receita</Muted>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.red }} />
          <Muted>Despesa</Muted>
        </View>
      </View>
    </View>
  );
}

export const chartStyles = StyleSheet.create({
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

export { areaColor };
