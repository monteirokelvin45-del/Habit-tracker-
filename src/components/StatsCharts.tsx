import React from 'react';
import { View } from 'react-native';
import { areaColor, colors, scoreColor, spacing } from '../theme';
import { Muted, Txt } from './ui';
import type {
  BubblePoint,
  Bucket,
  CalendarCell,
  CumulativePoint,
  GaugeInfo,
  HabitRank,
  HourCell,
  MovingPoint,
  RadarPoint,
  ScatterPoint,
  Slice,
  StackDay,
  StreakInfo,
  TimelineItem,
  WaffleCell,
  WeekdayStat,
} from '../lib/stats';

/**
 * Gráficos do MY PRIME.
 *
 * Regras aplicadas em TODOS:
 *  - sem dado é `null`, nunca 0: a linha quebra, a barra fica apagada, o texto diz "Sem dado";
 *  - nada é interpolado (buraco é buraco);
 *  - eixo e escala sempre visíveis: um ponto sem referência numérica não é gráfico, é enfeite.
 *
 * Desenhados com react-native-svg (linhas/arcos) e Views (barras/grades), sem lib de chart.
 */

const svg = () => require('react-native-svg') as any;
const SvgView = () => require('react-native-svg').default as React.ComponentType<any>;

/* ─────────────────────────── 1. Heatmap de calendário ─────────────────────────── */

export function CalendarHeatmap({
  weeks,
  monthLabel,
  cell = 34,
  onPressDay,
}: {
  weeks: CalendarCell[][];
  monthLabel?: string;
  cell?: number;
  onPressDay?: (cell: CalendarCell) => void;
}) {
  const header = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  return (
    <View style={{ gap: 6 }}>
      {monthLabel ? <Muted>{monthLabel}</Muted> : null}
      <View style={{ flexDirection: 'row', gap: 4 }}>
        {header.map((h, i) => (
          <View key={`${h}-${i}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>{h}</Txt>
          </View>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={`w-${wi}`} style={{ flexDirection: 'row', gap: 4 }}>
          {week.map((c) => {
            const sameMonth = monthLabel ? c.date.startsWith(monthLabel) : true;
            const bg = !c.recorded ? colors.bgElevated : scoreColor(c.score ?? 0) + (c.score != null && c.score >= 8 ? 'DD' : 'AA');
            return (
              <View
                key={c.date}
                onStartShouldSetResponder={() => !!onPressDay}
                onResponderRelease={() => onPressDay?.(c)}
                style={{
                  flex: 1,
                  height: cell,
                  borderRadius: 8,
                  backgroundColor: sameMonth ? bg : colors.bgPrimary,
                  borderWidth: c.isToday ? 1.5 : 1,
                  borderColor: c.isToday ? colors.textPrimary : sameMonth ? 'transparent' : colors.border + '55',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: c.isFuture ? 0.35 : sameMonth ? 1 : 0.4,
                }}
              >
                <Txt
                  variant="micro"
                  color={c.recorded ? colors.black : colors.textMuted}
                  style={{ fontSize: 10, fontWeight: '700' }}
                >
                  {Number(c.date.slice(8, 10))}
                </Txt>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/* ─────────────────────── 2. Streak: atual vs recorde ─────────────────────── */

export function StreakCompare({ info }: { info: StreakInfo }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.textSecondary}>ATUAL</Txt>
          <Txt variant="h1" color={colors.green}>🔥 {info.current}</Txt>
        </View>
        <View style={{ flex: 1 }}>
          <Txt variant="micro" color={colors.textSecondary}>RECORDE</Txt>
          <Txt variant="h1" color={colors.yellow}>🏆 {info.best}</Txt>
        </View>
      </View>
      {info.bestStart && info.bestEnd ? (
        <Muted>
          Recorde de {info.best} dia(s): {info.bestStart.slice(8, 10)}/{info.bestStart.slice(5, 7)} até{' '}
          {info.bestEnd.slice(8, 10)}/{info.bestEnd.slice(5, 7)}
        </Muted>
      ) : (
        <Muted>Sem série registrada ainda</Muted>
      )}
      {/* barrinha dos últimos 30 dias */}
      <View style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end', height: 28 }}>
        {info.series.map((s) => (
          <View
            key={s.date}
            style={{
              flex: 1,
              height: s.ok ? 28 : 6,
              borderRadius: 2,
              backgroundColor: s.ok ? colors.green : colors.track,
            }}
          />
        ))}
      </View>
      <Muted>Últimos 30 dias · barra cheia = dia com score acima de 5</Muted>
    </View>
  );
}

/* ───────────────────── 3/4. Barras semanais e mensais ───────────────────── */

export function PeriodBars({
  buckets,
  height = 120,
  unit = '',
  emptyLabel = 'Sem dado no período',
}: {
  buckets: Bucket[];
  height?: number;
  unit?: string;
  emptyLabel?: string;
}) {
  const max = 10;
  const hasAny = buckets.some((b) => b.avgScore != null);
  if (!hasAny) return <Muted>{emptyLabel}</Muted>;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 6 }}>
        {buckets.map((b) => {
          const v = b.avgScore;
          const h = v == null ? 4 : Math.max(6, (Math.min(v, max) / max) * height);
          return (
            <View key={b.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
              {v != null ? (
                <Txt variant="micro" color={colors.textSecondary} style={{ fontSize: 9 }}>{v.toFixed(1)}</Txt>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: 4,
                  backgroundColor: v == null ? colors.track : scoreColor(v),
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {buckets.map((b) => (
          <View key={`l-${b.key}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>{b.label}</Txt>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>
              {b.recorded}/{b.total}
            </Txt>
          </View>
        ))}
      </View>
      <Muted>Barra = média do score no período{unit ? ` (${unit})` : ''} · número embaixo = dias registrados</Muted>
    </View>
  );
}

/* ─────────────────────── 5. Anel de progresso diário ─────────────────────── */

export function ProgressRing({
  ratio,
  done,
  total,
  size = 132,
  label = 'do checklist',
}: {
  ratio: number;
  done: number;
  total: number;
  size?: number;
  label?: string;
}) {
  const Svg = SvgView();
  const { Circle, G } = svg();
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, ratio));
  const color = pct >= 1 ? colors.greenNeon : pct >= 0.6 ? colors.green : pct >= 0.3 ? colors.yellow : colors.red;

  if (!total) return <Muted>Sem dado{label ? ` ${label}` : ''}</Muted>;

  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * pct} ${c}`}
          />
        </G>
      </Svg>
      <View style={{ position: 'absolute', top: size / 2 - 20, alignItems: 'center' }}>
        <Txt variant="h2" color={color}>{Math.round(pct * 100)}%</Txt>
        <Txt variant="micro" color={colors.textSecondary}>{done}/{total}</Txt>
      </View>
      {label ? <Muted>{label}</Muted> : null}
    </View>
  );
}

/* ───────────────────── 6. Grade por dia da semana ───────────────────── */

export function WeekdayGrid({ data }: { data: WeekdayStat[] }) {
  const hasAny = data.some((d) => d.avgScore != null);
  if (!hasAny) return <Muted>Sem dado suficiente (registre pelo menos 1 dia fechado)</Muted>;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {data.map((d) => {
          const v = d.avgScore;
          const intensity = v == null ? 0 : Math.max(0.12, Math.min(1, v / 10));
          return (
            <View key={d.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  height: 54,
                  borderRadius: 10,
                  backgroundColor: v == null ? colors.track : scoreColor(v) + 'CC',
                  opacity: 0.35 + intensity * 0.65,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Txt variant="caption" color={v == null ? colors.textMuted : colors.black} style={{ fontWeight: '800' }}>
                  {v == null ? '—' : v.toFixed(1)}
                </Txt>
              </View>
              <Txt variant="micro" color={colors.textSecondary} style={{ fontSize: 9 }}>{d.label}</Txt>
              <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>
                {d.samples}d
              </Txt>
            </View>
          );
        })}
      </View>
      <Muted>Score médio por dia da semana (últimas 8 semanas) · "d" = dias registrados</Muted>
    </View>
  );
}

/* ────────────── 7. Linha de conclusão com média móvel ────────────── */

export function CompletionLine({ points, height = 150 }: { points: MovingPoint[]; height?: number }) {
  const Svg = SvgView();
  const { Path, Line, Circle, Text: SvgText, G } = svg();
  const width = 320;
  const padX = 26;
  const padY = 10;
  const innerW = width - padX - 4;
  const innerH = height - padY * 2;
  const n = Math.max(points.length, 2);
  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padY + innerH - (Math.max(0, Math.min(100, v)) / 100) * innerH;

  const pathFor = (get: (p: MovingPoint) => number | null) => {
    let d = '';
    let started = false;
    points.forEach((p, i) => {
      const v = get(p);
      if (v == null) {
        started = false;
        return;
      }
      d += `${started ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)} `;
      started = true;
    });
    return d.trim();
  };

  const valid = points.filter((p) => p.value != null).length;
  if (valid < 3) return <Muted>Gráficos a partir de 3 pontos de dado</Muted>;

  return (
    <View style={{ gap: 6 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <G>
          {[0, 25, 50, 75, 100].map((g) => (
            <G key={g}>
              <Line x1={padX} x2={width} y1={yOf(g)} y2={yOf(g)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padX - 4} y={yOf(g) + 3} fill={colors.textMuted} fontSize={7} textAnchor="end">{g}%</SvgText>
            </G>
          ))}
          <Path d={pathFor((p) => p.value)} stroke={colors.cyan} strokeWidth={1.5} fill="none" strokeDasharray="3 3" />
          <Path d={pathFor((p) => p.average)} stroke={colors.green} strokeWidth={2.5} fill="none" />
          {points.map((p, i) =>
            p.value == null ? null : <Circle key={`c-${p.date}`} cx={xOf(i)} cy={yOf(p.value)} r={1.8} fill={colors.cyan} />,
          )}
          {points.map((p, i) =>
            i % Math.ceil(points.length / 6) === 0 ? (
              <SvgText key={`t-${p.date}`} x={xOf(i)} y={height - 1} fill={colors.textMuted} fontSize={7} textAnchor="middle">
                {p.date.slice(8, 10)}
              </SvgText>
            ) : null,
          )}
        </G>
      </Svg>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <LegendDot color={colors.cyan} label="% do dia" />
        <LegendDot color={colors.green} label="média móvel (7)" />
      </View>
    </View>
  );
}

/* ────────────── 8. Barras com linha de meta ────────────── */

export function BarsWithTarget({
  data,
  unit = '%',
}: {
  data: { label: string; value: number | null; target: number }[];
  unit?: string;
}) {
  const hasAny = data.some((d) => d.value != null);
  if (!hasAny) return <Muted>Sem dado: nenhuma tarefa registrada no período</Muted>;
  const max = Math.max(100, ...data.map((d) => d.target), ...data.map((d) => d.value ?? 0));
  return (
    <View style={{ gap: 8 }}>
      {data.map((d) => {
        const w = d.value == null ? 0 : Math.min(100, (d.value / max) * 100);
        const tw = Math.min(100, (d.target / max) * 100);
        const ok = d.value != null && d.value >= d.target;
        return (
          <View key={d.label} style={{ gap: 3 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Txt variant="micro" color={colors.textSecondary}>{d.label}</Txt>
              <Txt variant="micro" color={d.value == null ? colors.textMuted : ok ? colors.green : colors.yellow}>
                {d.value == null ? 'Sem dado' : `${d.value}${unit}`}
              </Txt>
            </View>
            <View style={{ height: 10, backgroundColor: colors.track, borderRadius: 5, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${w}%`,
                  height: '100%',
                  borderRadius: 5,
                  backgroundColor: d.value == null ? 'transparent' : ok ? colors.green : colors.yellow,
                }}
              />
              {/* linha de meta */}
              <View
                style={{
                  position: 'absolute',
                  left: `${tw}%`,
                  top: -2,
                  bottom: -2,
                  width: 2,
                  backgroundColor: colors.textPrimary,
                  opacity: 0.7,
                }}
              />
            </View>
          </View>
        );
      })}
      <Muted>Barra = consistência · linha branca = meta ({data[0]?.target ?? 0}{unit})</Muted>
    </View>
  );
}

/* ────────────── 9. Linha de tendência ────────────── */

export function TrendChart({
  points,
  projection,
  height = 150,
}: {
  points: { date: string; value: number }[];
  projection: { date: string; value: number }[];
  height?: number;
}) {
  const Svg = SvgView();
  const { Path, Line, Circle, Text: SvgText, G } = svg();
  const width = 320;
  const padX = 26;
  const padY = 10;
  const innerW = width - padX - 6;
  const innerH = height - padY * 2;
  const n = Math.max(points.length, 2);
  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padY + innerH - (Math.max(0, Math.min(10, v)) / 10) * innerH;

  if (points.length < 3) return <Muted>Gráficos a partir de 3 pontos de dado</Muted>;

  const line = (vals: { value: number }[]) =>
    vals.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(p.value).toFixed(1)}`).join(' ');

  return (
    <View style={{ gap: 6 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <G>
          {[0, 2.5, 5, 7.5, 10].map((g) => (
            <G key={g}>
              <Line x1={padX} x2={width} y1={yOf(g)} y2={yOf(g)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padX - 4} y={yOf(g) + 3} fill={colors.textMuted} fontSize={7} textAnchor="end">{g}</SvgText>
            </G>
          ))}
          <Path d={line(points)} stroke={colors.textMuted} strokeWidth={1.5} fill="none" />
          {points.map((p, i) => (
            <Circle key={p.date} cx={xOf(i)} cy={yOf(p.value)} r={2} fill={colors.textSecondary} />
          ))}
          {projection.length ? (
            <Path d={line(projection)} stroke={colors.purple} strokeWidth={2} fill="none" strokeDasharray="5 4" />
          ) : null}
        </G>
      </Svg>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <LegendDot color={colors.textSecondary} label="score real" />
        <LegendDot color={colors.purple} label="tendência (regressão)" />
      </View>
    </View>
  );
}

/* ────────────── 10. Linha cumulativa ────────────── */

export function CumulativeChart({ points, height = 140 }: { points: CumulativePoint[]; height?: number }) {
  const Svg = SvgView();
  const { Path, Line, Circle, Text: SvgText, G } = svg();
  const width = 320;
  const padX = 30;
  const padY = 10;
  const innerW = width - padX - 6;
  const innerH = height - padY * 2;
  const n = Math.max(points.length, 2);
  const maxVal = Math.max(1, ...points.map((p) => p.done ?? 0));
  const xOf = (i: number) => padX + (i / Math.max(1, n - 1)) * innerW;
  const yOf = (v: number) => padY + innerH - (v / maxVal) * innerH;

  const valid = points.filter((p) => p.done != null).length;
  if (valid < 3) return <Muted>Gráficos a partir de 3 pontos de dado</Muted>;

  let d = '';
  let started = false;
  points.forEach((p, i) => {
    if (p.done == null) {
      started = false;
      return;
    }
    d += `${started ? 'L' : 'M'}${xOf(i).toFixed(1)},${yOf(p.done).toFixed(1)} `;
    started = true;
  });

  const last = [...points].reverse().find((p) => p.done != null);
  return (
    <View style={{ gap: 6 }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <G>
          {[0, 0.5, 1].map((f) => (
            <G key={f}>
              <Line x1={padX} x2={width} y1={yOf(maxVal * f)} y2={yOf(maxVal * f)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={padX - 4} y={yOf(maxVal * f) + 3} fill={colors.textMuted} fontSize={7} textAnchor="end">
                {Math.round(maxVal * f)}
              </SvgText>
            </G>
          ))}
          <Path d={d.trim()} stroke={colors.blue} strokeWidth={2.5} fill="none" />
          {points.map((p, i) =>
            p.done == null ? null : <Circle key={p.date} cx={xOf(i)} cy={yOf(p.done)} r={1.6} fill={colors.blue} />,
          )}
        </G>
      </Svg>
      <Muted>
        Tarefas concluídas acumuladas{last?.done != null ? ` · total ${last.done}` : ''} (nunca cai)
      </Muted>
    </View>
  );
}

/* ────────────── 11. Radar de equilíbrio ────────────── */

export function BalanceRadar({ data, size = 260 }: { data: RadarPoint[]; size?: number }) {
  const Svg = SvgView();
  const { Polygon, Line, Circle, Text: SvgText, G } = svg();
  const usable = data.filter((d) => d.value != null);
  if (usable.length < 3) return <Muted>Radar precisa de 3 áreas com dado</Muted>;

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const n = data.length;
  const pointFor = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (Math.max(0, Math.min(10, value)) / 10) * r;
    return { x: cx + Math.cos(angle) * rr, y: cy + Math.sin(angle) * rr };
  };

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <Polygon
              key={f}
              points={data.map((_, i) => {
                const p = pointFor(i, 10 * f);
                return `${p.x},${p.y}`;
              }).join(' ')}
              stroke={colors.border}
              strokeWidth={1}
              fill="none"
            />
          ))}
          {data.map((_, i) => {
            const p = pointFor(i, 10);
            return <Line key={`ax-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke={colors.border} strokeWidth={1} />;
          })}
          <Polygon
            points={data.map((d, i) => {
              const p = pointFor(i, d.value ?? 0);
              return `${p.x},${p.y}`;
            }).join(' ')}
            stroke={colors.green}
            strokeWidth={2}
            fill={colors.green + '33'}
          />
          {data.map((d, i) => {
            const p = pointFor(i, d.value ?? 0);
            return <Circle key={`pt-${i}`} cx={p.x} cy={p.y} r={3} fill={areaColor(d.area)} />;
          })}
          {data.map((d, i) => {
            const p = pointFor(i, 11.8);
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
      <Muted>0 no centro, 10 na borda · área sem dado fica no centro (não é zero, é ausência)</Muted>
    </View>
  );
}

/* ────────────── 12. Ranking horizontal de hábitos ────────────── */

export function HabitRankingBars({ data, limit = 8 }: { data: HabitRank[]; limit?: number }) {
  const rows = data.slice(0, limit);
  if (!rows.length) return <Muted>Sem hábitos ativos</Muted>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((h) => (
        <View key={h.goalId} style={{ gap: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Txt variant="caption" color={colors.textPrimary} numberOfLines={1} style={{ flex: 1 }}>
              {h.name}
            </Txt>
            <Txt variant="micro" color={h.pct == null ? colors.textMuted : colors.textSecondary}>
              {h.pct == null ? 'Sem dado' : `${h.pct}%`}
              {h.streak > 0 ? ` · 🔥${h.streak}` : ''}
            </Txt>
          </View>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.track }}>
            <View
              style={{
                width: `${h.pct ?? 0}%`,
                height: '100%',
                borderRadius: 4,
                backgroundColor: areaColor(h.area),
              }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ────────────── 13. Heatmap por hora do dia ────────────── */

export function HourHeatmap({ data }: { data: HourCell[] }) {
  const max = Math.max(1, ...data.map((d) => d.done + d.failed));
  const hasAny = data.some((d) => d.done + d.failed > 0);
  if (!hasAny) return <Muted>Sem horário registrado: marque tarefas no app para mapear as horas</Muted>;
  const blocks = [0, 6, 12, 18].map((start) => data.slice(start, start + 6));
  const labels = ['00–05', '06–11', '12–17', '18–23'];
  return (
    <View style={{ gap: 8 }}>
      {blocks.map((block, bi) => (
        <View key={labels[bi]} style={{ gap: 4 }}>
          <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>{labels[bi]}</Txt>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {block.map((cell) => {
              const total = cell.done + cell.failed;
              const intensity = total / max;
              const bg =
                total === 0
                  ? colors.bgElevated
                  : cell.done >= cell.failed
                    ? colors.green
                    : colors.red;
              return (
                <View key={cell.hour} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <View
                    style={{
                      width: '100%',
                      height: 34,
                      borderRadius: 6,
                      backgroundColor: bg,
                      opacity: total === 0 ? 1 : 0.25 + intensity * 0.75,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Txt variant="micro" color={total === 0 ? colors.textMuted : colors.black} style={{ fontSize: 9, fontWeight: '700' }}>
                      {total || ''}
                    </Txt>
                  </View>
                  <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>{cell.hour}</Txt>
                </View>
              );
            })}
          </View>
        </View>
      ))}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <LegendDot color={colors.green} label="concluídas" />
        <LegendDot color={colors.red} label="falhas" />
      </View>
    </View>
  );
}

/* ────────────── 14. Dispersão hábito × energia/humor ────────────── */

export function EnergyScatter({
  points,
  correlation,
  xLabel,
  size = 240,
}: {
  points: ScatterPoint[];
  correlation: number | null;
  xLabel: string;
  size?: number;
}) {
  const Svg = SvgView();
  const { Line, Circle, Text: SvgText, G } = svg();
  const pad = 32;
  const inner = size - pad * 1.4;
  const xMax = Math.max(5, ...points.map((p) => p.x));
  const xOf = (x: number) => pad + (x / xMax) * inner;
  const yOf = (y: number) => size - pad - (y / 10) * inner;

  if (points.length < 3) return <Muted>Gráficos a partir de 3 pontos de dado</Muted>;

  return (
    <View style={{ gap: 6, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {[0, 5, 10].map((v) => (
            <G key={`y${v}`}>
              <Line x1={pad} x2={size - pad / 2} y1={yOf(v)} y2={yOf(v)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={pad - 6} y={yOf(v) + 3} fill={colors.textMuted} fontSize={8} textAnchor="end">{v}</SvgText>
            </G>
          ))}
          {points.map((p) => (
            <Circle
              key={p.date}
              cx={xOf(p.x)}
              cy={yOf(p.y)}
              r={Math.max(3, Math.min(8, p.tasks + 1))}
              fill={colors.cyan + '99'}
              stroke={colors.cyan}
              strokeWidth={1}
            />
          ))}
          <SvgText x={size / 2} y={size - 6} fill={colors.textSecondary} fontSize={9} textAnchor="middle">{xLabel}</SvgText>
          <SvgText x={10} y={pad - 10} fill={colors.textSecondary} fontSize={9}>itens feitos</SvgText>
        </G>
      </Svg>
      <Muted>
        {correlation == null
          ? 'Correlação só com 7+ dias de dado (regra 4)'
          : `Correlação ${correlation > 0 ? '+' : ''}${correlation.toFixed(2)} · ${
              Math.abs(correlation) < 0.3 ? 'fraca' : Math.abs(correlation) < 0.6 ? 'moderada' : 'forte'
            } (${correlation > 0 ? 'sobe junto' : 'anda ao contrário'})`}
      </Muted>
    </View>
  );
}

/* ────────────── 15. Barras empilhadas ────────────── */

export function StackedBars({
  data,
  height = 120,
}: {
  data: StackDay[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.done + d.skipped + d.failed));
  const hasAny = data.some((d) => d.done + d.skipped + d.failed > 0);
  if (!hasAny) return <Muted>Sem dado no período</Muted>;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 3 }}>
        {data.map((d) => {
          const total = d.done + d.skipped + d.failed;
          const seg = (v: number) => (total ? (v / max) * height : 0);
          return (
            <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ width: '100%', borderRadius: 3, overflow: 'hidden' }}>
                {d.failed ? <View style={{ height: seg(d.failed), backgroundColor: colors.red }} /> : null}
                {d.skipped ? <View style={{ height: seg(d.skipped), backgroundColor: colors.track }} /> : null}
                {d.done ? <View style={{ height: seg(d.done), backgroundColor: colors.green }} /> : null}
                {total === 0 ? <View style={{ height: 3, backgroundColor: colors.border }} /> : null}
              </View>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {data.map((d) => (
          <View key={`l-${d.date}`} style={{ flex: 1, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>{d.label}</Txt>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <LegendDot color={colors.green} label="concluído" />
        <LegendDot color={colors.track} label="pulado (sem registro de falha)" />
        <LegendDot color={colors.red} label="falhou (com motivo)" />
      </View>
    </View>
  );
}

/* ────────────── 16. Timeline de conclusões ────────────── */

export function TimelineList({ items }: { items: TimelineItem[] }) {
  if (!items.length) return <Muted>Nenhuma conclusão com horário registrado ainda</Muted>;
  return (
    <View style={{ gap: 0 }}>
      {items.map((it, i) => (
        <View key={`${it.date}-${it.at}-${i}`} style={{ flexDirection: 'row', gap: spacing.md }}>
          {/* trilho */}
          <View style={{ width: 34, alignItems: 'center' }}>
            <Txt variant="micro" color={colors.textSecondary} style={{ fontSize: 10 }}>{it.at}</Txt>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                marginTop: 3,
                backgroundColor: it.kind === 'done' ? colors.green : colors.red,
              }}
            />
            {i < items.length - 1 ? (
              <View style={{ width: 1, flex: 1, minHeight: 18, backgroundColor: colors.border }} />
            ) : null}
          </View>
          <View style={{ flex: 1, paddingBottom: spacing.md }}>
            <Txt variant="caption" color={it.kind === 'done' ? colors.textPrimary : colors.textSecondary} numberOfLines={1}>
              {it.kind === 'done' ? '✓' : '✗'} {it.label}
            </Txt>
            <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 10 }}>
              {it.area} · {it.date.slice(8, 10)}/{it.date.slice(5, 7)}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
}

/* ────────────── 17. Bolhas: frequência × consistência ────────────── */

export function BubbleChart({ points, size = 250 }: { points: BubblePoint[]; size?: number }) {
  const Svg = SvgView();
  const { Line, Circle, Text: SvgText, G } = svg();
  const pad = 34;
  const inner = size - pad * 1.5;
  const xMax = Math.max(5, ...points.map((p) => p.frequency));
  const xOf = (x: number) => pad + (x / xMax) * inner;
  const yOf = (y: number) => size - pad - (y / 100) * inner;
  const maxVol = Math.max(1, ...points.map((p) => p.volume));

  const usable = points.filter((p) => p.consistency != null);
  if (usable.length < 2) return <Muted>Sem dado suficiente: precisa de 2+ hábitos com registro</Muted>;

  return (
    <View style={{ gap: 6, alignItems: 'center' }}>
      <Svg width={size} height={size}>
        <G>
          {[0, 50, 100].map((v) => (
            <G key={`y${v}`}>
              <Line x1={pad} x2={size - pad / 2} y1={yOf(v)} y2={yOf(v)} stroke={colors.border} strokeWidth={1} />
              <SvgText x={pad - 6} y={yOf(v) + 3} fill={colors.textMuted} fontSize={8} textAnchor="end">{v}%</SvgText>
            </G>
          ))}
          <Line x1={pad} x2={pad} y1={yOf(0)} y2={yOf(100)} stroke={colors.border} strokeWidth={1} />
          {points.map((p) => (
            <Circle
              key={p.goalId}
              cx={xOf(p.frequency)}
              cy={yOf(p.consistency ?? 0)}
              r={6 + (p.volume / maxVol) * 10}
              fill={areaColor(p.area) + '66'}
              stroke={areaColor(p.area)}
              strokeWidth={1.5}
            />
          ))}
          <SvgText x={size / 2} y={size - 8} fill={colors.textSecondary} fontSize={9} textAnchor="middle">
            frequência (dias cumpridos)
          </SvgText>
          <SvgText x={pad - 28} y={pad - 12} fill={colors.textSecondary} fontSize={9}>consistência</SvgText>
        </G>
      </Svg>
      <Muted>Bolha maior = mais itens no período · canto superior direito = hábito frequente e consistente</Muted>
    </View>
  );
}

/* ────────────── 18. Waffle chart ────────────── */

export function WaffleChart({
  cells,
  done,
  partial,
  columns = 20,
}: {
  cells: WaffleCell[];
  done: number;
  partial: number;
  columns?: number;
}) {
  const rows: WaffleCell[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));
  const color = (state: WaffleCell['state']) =>
    state === 'done' ? colors.green : state === 'partial' ? colors.yellow + 'AA' : state === 'future' ? colors.border : colors.bgElevated;

  return (
    <View style={{ gap: 8 }}>
      <View style={{ gap: 3 }}>
        {rows.map((row, ri) => (
          <View key={`r-${ri}`} style={{ flexDirection: 'row', gap: 3 }}>
            {row.map((c) => (
              <View
                key={c.index}
                style={{ flex: 1, aspectRatio: 1, borderRadius: 3, backgroundColor: color(c.state) }}
              />
            ))}
          </View>
        ))}
      </View>
      <View>
        <Txt variant="h3" color={colors.green}>{done} de {cells.length} dias cumpridos</Txt>
        <Muted>{partial} dia(s) parcial(is) · o resto sem registro</Muted>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        <LegendDot color={colors.green} label="cumprido (score ≥ 6)" />
        <LegendDot color={colors.yellow + 'AA'} label="parcial" />
        <LegendDot color={colors.bgElevated} label="sem registro" />
      </View>
    </View>
  );
}

/* ────────────── 19. Sparkline ────────────── */

export function Sparkline({
  values,
  width = 88,
  height = 26,
  color = colors.green,
}: {
  values: { date: string; value: number | null }[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const Svg = SvgView();
  const { Line, Rect } = svg();
  const colW = width / Math.max(1, values.length);
  if (!values.some((v) => v.value != null)) {
    return <Muted style={{ fontSize: 9 }}>Sem dado</Muted>;
  }
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {values.map((v, i) => {
          const h = v.value == null ? 2 : v.value ? height - 2 : height * 0.45;
          return (
            <Rect
              key={v.date}
              x={i * colW}
              y={height - h}
              width={Math.max(1.5, colW - 1.5)}
              height={h}
              rx={1}
              fill={v.value == null ? colors.track : v.value ? color : colors.red + '77'}
            />
          );
        })}
        <Line x1={0} y1={height} x2={width} y2={height} stroke={colors.border} strokeWidth={1} />
      </Svg>
    </View>
  );
}

/* ────────────── 20. Gauge de meta mensal ────────────── */

export function MonthlyGauge({ info, size = 190 }: { info: GaugeInfo; size?: number }) {
  const Svg = SvgView();
  const { Path, Circle, Text: SvgText, G } = svg();
  const stroke = 16;
  const r = (size - stroke) / 2 - 6;
  const cx = size / 2;
  const cy = size / 2;
  // Arco de 270° (de -225° a 45°), estilo velocímetro.
  const startAngle = 135;
  const sweep = 270;
  const polar = (angleDeg: number, radius: number) => {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  };
  const arc = (from: number, to: number, radius: number) => {
    const s = polar(from, radius);
    const e = polar(to, radius);
    const large = Math.abs(to - from) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const pct = Math.max(0, Math.min(1, info.ratio));
  const end = startAngle + sweep * pct;
  const color = pct >= 1 ? colors.greenNeon : info.onTrack ? colors.green : colors.yellow;
  const needle = polar(end, r - 14);

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <Svg width={size} height={size * 0.86}>
        <G>
          <Path d={arc(startAngle, startAngle + sweep, r)} stroke={colors.track} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          <Path d={arc(startAngle, end, r)} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" />
          <Circle cx={needle.x} cy={needle.y} r={4} fill={colors.textPrimary} />
          <SvgText x={cx} y={cy - 4} fill={colors.textPrimary} fontSize={26} textAnchor="middle" fontWeight="bold">
            {Math.round(info.ratio * 100)}%
          </SvgText>
          <SvgText x={cx} y={cy + 16} fill={colors.textSecondary} fontSize={10} textAnchor="middle">
            {info.label}
          </SvgText>
          <SvgText x={cx} y={cy + 40} fill={info.onTrack ? colors.green : colors.yellow} fontSize={9} textAnchor="middle">
            {info.onTrack ? 'no ritmo' : 'abaixo do ritmo'}
          </SvgText>
        </G>
      </Svg>
      <Muted>
        Projeção de fechamento: {info.projection}/{info.target} dias · faltam {info.daysLeft} dia(s) no mês
      </Muted>
    </View>
  );
}

/* ────────────── 21. Donut de distribuição ────────────── */

export function CategoryDonut({
  data,
  size = 170,
  centerLabel,
  unit = '',
}: {
  data: Slice[];
  size?: number;
  centerLabel?: string;
  unit?: string;
}) {
  const Svg = SvgView();
  const { Circle, G, Text: SvgText } = svg();
  const total = data.reduce((a, b) => a + b.value, 0);
  if (!total) return <Muted>Sem dado para este período.</Muted>;

  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={stroke} fill="none" />
          {data.map((d) => {
            const dash = (d.value / total) * c;
            const el = (
              <Circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                stroke={areaColor(d.label)}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return el;
          })}
        </G>
        <SvgText x={size / 2} y={size / 2 - 2} fill={colors.textPrimary} fontSize={15} textAnchor="middle" fontWeight="bold">
          {total > 999 ? `${(total / 1000).toFixed(1)}k` : total}
        </SvgText>
        {centerLabel ? (
          <SvgText x={size / 2} y={size / 2 + 13} fill={colors.textSecondary} fontSize={8} textAnchor="middle">
            {centerLabel}
          </SvgText>
        ) : null}
      </Svg>
      <View style={{ gap: 4, flex: 1, minWidth: 130 }}>
        {data.map((d) => (
          <View key={d.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: areaColor(d.label) }} />
              <Txt variant="micro" color={colors.textSecondary}>{d.label}</Txt>
            </View>
            <Txt variant="micro" color={colors.textPrimary}>
              {Math.round((d.value / total) * 100)}%{unit ? ` · ${d.value}${unit}` : ''}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ─────────────────────────────── util ─────────────────────────────── */

export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Muted style={{ fontSize: 10 }}>{label}</Muted>
    </View>
  );
}

export type { Bucket };
