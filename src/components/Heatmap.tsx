import React, { useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, scoreColor, spacing } from '../theme';
import { Badge, Card, Muted, NoData, Row, Sheet, Txt } from './ui';
import { buildHeatmap, levelFor, type HeatCell, type HeatLevel } from '../lib/heatmap';
import { goalForTask } from '../lib/score';
import { shortDate, weekdayShort } from '../lib/date';
import { haptic } from '../lib/haptics';
import type { Day, Goal } from '../lib/types';
import { useStore } from '../lib/store';

export function heatColor(level: HeatLevel): string {
  switch (level) {
    case 1:
      return colors.red + 'AA';
    case 2:
      return colors.yellow + 'CC';
    case 3:
      return colors.green + 'AA';
    case 4:
      return colors.greenNeon;
    default:
      return '#1F1F1F';
  }
}

const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/**
 * Mural de constância: cada quadrado é um dia. Quanto mais claro/neon, mais alto o score.
 * Toque em qualquer dia para ver o que aconteceu nele.
 */
export function ConstancyHeatmap({
  days,
  goals,
  weeks = 53,
  cellSize,
}: {
  days: Day[];
  goals: Goal[];
  weeks?: number;
  cellSize?: number;
}) {
  const compact = cellSize != null;
  const size = cellSize ?? 11;
  const gap = compact ? 2 : 3;
  const [selected, setSelected] = useState<HeatCell | null>(null);

  const model = useMemo(() => buildHeatmap(days, { weeks }), [days, weeks]);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <Card>
      <Row style={{ justifyContent: 'space-between', marginBottom: spacing.sm }}>
        <View>
          <Txt variant="h3">Mural de constância</Txt>
          <Muted>
            {model.stats.fulfilled} dia(s) cumprido(s) · {model.stats.recorded} registrado(s)
          </Muted>
        </View>
        <Badge label={`${weeks} sem`} color={colors.green} />
      </Row>

      {model.stats.recorded === 0 ? (
        <NoData label="Sem dado ainda — o mural acende quando você fecha o dia" />
      ) : null}

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        contentContainerStyle={{ paddingTop: 4 }}
      >
        <View>
          {/* meses */}
          <View style={{ flexDirection: 'row', marginLeft: 22, marginBottom: 3 }}>
            {model.weeks.map((week) => {
              const label = model.monthLabels.find((m) => m.column === week.index);
              return (
                <View key={`m-${week.index}`} style={{ width: size + gap }}>
                  {label ? (
                    <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>
                      {MONTH_SHORT[Number(week.cells[0]!.date.slice(5, 7)) - 1]}
                    </Txt>
                  ) : null}
                </View>
              );
            })}
          </View>

          <View style={{ flexDirection: 'row' }}>
            {/* dias da semana */}
            <View style={{ width: 22, justifyContent: 'space-between', paddingVertical: 0 }}>
              {['Seg', '', 'Qua', '', 'Sex', '', ''].map((d, i) => (
                <View key={`d-${i}`} style={{ height: size + gap, justifyContent: 'center' }}>
                  <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 8 }}>
                    {d}
                  </Txt>
                </View>
              ))}
            </View>

            {model.weeks.map((week) => (
              <View key={`w-${week.index}`} style={{ gap }}>
                {week.cells.map((cell) => (
                  <PressableCell
                    key={cell.date}
                    cell={cell}
                    size={size}
                    onPress={() => {
                      haptic('light');
                      setSelected(cell);
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* legenda */}
      <Row gap={6} style={{ marginTop: spacing.sm, justifyContent: 'flex-end' }}>
        <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>Menos</Txt>
        {([0, 1, 2, 3, 4] as HeatLevel[]).map((l) => (
          <View key={l} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: heatColor(l) }} />
        ))}
        <Txt variant="micro" color={colors.textMuted} style={{ fontSize: 9 }}>Mais</Txt>
      </Row>

      <Sheet
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Registro · ${weekdayShort(selected.date)} ${shortDate(selected.date)}` : ''}
      >
        {selected ? <DayDetail cell={selected} goals={goals} /> : null}
      </Sheet>
    </Card>
  );
}

function PressableCell({ cell, size, onPress }: { cell: HeatCell; size: number; onPress: () => void }) {
  const opacity = cell.isFuture ? 0.25 : 1;
  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderRelease={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${shortDate(cell.date)}: ${cell.score != null ? `score ${cell.score.toFixed(1)}` : 'sem registro'}`}
      style={{
        width: size,
        height: size,
        borderRadius: 2,
        backgroundColor: heatColor(cell.level),
        opacity,
        borderWidth: cell.isToday ? 1 : 0,
        borderColor: colors.textPrimary,
      }}
    />
  );
}

function DayDetail({ cell, goals }: { cell: HeatCell; goals: Goal[] }) {
  const day = useStore((s) => s.days.find((d) => d.date === cell.date));
  if (!day || (!day.score && day.tasks.length === 0)) {
    return (
      <View style={{ gap: spacing.sm }}>
        <NoData label="Nenhum registro neste dia" />
        <Muted>Sem dado não é falha silenciosa: é um dia que não entrou no loop.</Muted>
      </View>
    );
  }

  const done = day.tasks.filter((t) => t.done);
  const missed = day.tasks.filter((t) => !t.done);

  return (
    <View style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="h2" color={cell.score != null ? scoreColor(cell.score) : colors.textMuted}>
          {cell.score != null ? cell.score.toFixed(1) : '—'}
        </Txt>
        <View style={{ alignItems: 'flex-end' }}>
          <Badge label={`${cell.done}/${cell.total} feitas`} color={colors.green} />
          {day.middayCheckin ? <Muted style={{ marginTop: 4 }}>check-in {day.middayCheckin.at}</Muted> : null}
        </View>
      </Row>

      {cell.score != null ? (
        <View style={{ gap: 4 }}>
          {([
            ['Regularidade', day.score?.regularity],
            ['Continuidade', day.score?.continuity],
            ['Recuperação', day.score?.recovery],
            ['Honestidade', day.score?.honesty],
            ['Progresso', day.score?.progress],
          ] as const).map(([label, value]) => (
            <Row key={label} style={{ justifyContent: 'space-between' }}>
              <Txt variant="micro" color={colors.textSecondary}>{label}</Txt>
              <Txt variant="micro" color={colors.textPrimary}>{(value ?? 0).toFixed(1)}</Txt>
            </Row>
          ))}
        </View>
      ) : null}

      <View>
        <Txt variant="micro" color={colors.textMuted}>FEITAS</Txt>
        {done.length ? (
          done.map((t) => {
            const goal = goalForTask(goals, t);
            return (
              <Txt key={t.goalId} variant="caption" color={colors.textPrimary} style={{ marginTop: 2 }}>
                ✓ {goal?.name ?? 'Tarefa'} {t.doneAt ? `· ${t.doneAt}` : ''}
              </Txt>
            );
          })
        ) : (
          <Muted style={{ marginTop: 2 }}>Sem dado</Muted>
        )}
      </View>

      {missed.length ? (
        <View>
          <Txt variant="micro" color={colors.textMuted}>NÃO FEITAS</Txt>
          {missed.map((t) => {
            const goal = goalForTask(goals, t);
            return (
              <Txt key={t.goalId} variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                ✗ {goal?.name ?? 'Tarefa'}
                {t.excuse ? ` · ${t.excuse.type}/${t.excuse.legitimacy}` : ''}
                {t.cost ? ` · custo: ${t.cost}` : ''}
              </Txt>
            );
          })}
        </View>
      ) : null}

      {day.diary.smallWin ? <Muted>Vitória pequena: {day.diary.smallWin}</Muted> : null}
      {day.diary.correction ? <Muted>Correção: {day.diary.correction}</Muted> : null}
    </View>
  );
}

/* ───────────── versão compacta (dashboard: 6 semanas) ───────────── */

export function MiniHeatmap({ days, weeks = 6 }: { days: Day[]; weeks?: number }) {
  const model = useMemo(() => buildHeatmap(days, { weeks }), [days, weeks]);
  const [selected, setSelected] = useState<HeatCell | null>(null);
  const size = 12;
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        {model.weeks.map((week) => (
          <View key={week.index} style={{ gap: 3 }}>
            {week.cells.map((cell) => (
              <View
                key={cell.date}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => {
                  haptic('light');
                  setSelected(cell);
                }}
                style={{
                  width: size,
                  height: size,
                  borderRadius: 2,
                  backgroundColor: heatColor(cell.level),
                  opacity: cell.isFuture ? 0.25 : 1,
                  borderWidth: cell.isToday ? 1 : 0,
                  borderColor: colors.textPrimary,
                }}
              />
            ))}
          </View>
        ))}
      </View>
      <Sheet visible={!!selected} onClose={() => setSelected(null)} title={selected ? shortDate(selected.date) : ''}>
        {selected ? (
          <View style={{ gap: 6 }}>
            <Txt variant="h2" color={selected.score != null ? scoreColor(selected.score) : colors.textMuted}>
              {selected.score != null ? selected.score.toFixed(1) : '—'}
            </Txt>
            <Muted>
              {selected.hasRecord
                ? `${selected.done}/${selected.total} tarefas feitas · nível ${levelFor(selected.score)} de 4`
                : 'Sem registro neste dia'}
            </Muted>
          </View>
        ) : null}
      </Sheet>
    </>
  );
}
