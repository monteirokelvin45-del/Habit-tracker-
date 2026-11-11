import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { Card, Chip, Muted, NoData, Row, Txt } from '../../src/components/ui';
import { ModalHeader } from '../../src/components/ModalHeader';
import { useStore } from '../../src/lib/store';
import { haptic } from '../../src/lib/haptics';
import { todayKey } from '../../src/lib/date';
import { closedDays } from '../../src/lib/insights';
import {
  areaBalance,
  areaVsTarget,
  bubbleHabits,
  calendarMonth,
  categoryDistribution,
  completionWithAverage,
  cumulativeDone,
  dailyProgress,
  habitRanking,
  hourHeatmap,
  monthlyBuckets,
  monthlyGauge,
  scatterEnergy,
  sparkline,
  stackedTasks,
  streakInfo,
  timeline,
  trendLine,
  waffle,
  weekdayGrid,
  weeklyBuckets,
} from '../../src/lib/stats';
import {
  BalanceRadar,
  BarsWithTarget,
  BubbleChart,
  CalendarHeatmap,
  CategoryDonut,
  CompletionLine,
  CumulativeChart,
  EnergyScatter,
  HabitRankingBars,
  HourHeatmap,
  MonthlyGauge,
  PeriodBars,
  ProgressRing,
  Sparkline,
  StackedBars,
  StreakCompare,
  TimelineList,
  TrendChart,
  WaffleChart,
  WeekdayGrid,
} from '../../src/components/StatsCharts';

type Group = 'todos' | 'constancia' | 'padroes' | 'habitos';

const GROUPS: { key: Group; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'constancia', label: 'Constância' },
  { key: 'padroes', label: 'Padrões' },
  { key: 'habitos', label: 'Hábitos' },
];

/**
 * Central de gráficos. Cada bloco é independente e diz o que está mostrando
 * (período, unidade, quantos pontos). Sem dado = "Sem dado", nunca zero.
 */
export default function ChartsScreen() {
  const store = useStore();
  const [group, setGroup] = useState<Group>('todos');
  const today = todayKey();
  const closed = closedDays(store.days);

  const data = useMemo(() => {
    const todayDay = store.days.find((d) => d.date === today);
    return {
      calendar: calendarMonth(store.days, today),
      streak: streakInfo(store.days, { end: today }),
      weekly: weeklyBuckets(store.days, 8, today),
      monthly: monthlyBuckets(store.days, 6, today),
      ring: dailyProgress(todayDay, store.goals),
      weekdays: weekdayGrid(store.days, 56, today),
      completion: completionWithAverage(store.days, { n: 30, window: 7, end: today }),
      vsTarget: areaVsTarget(store, 14, today),
      trend: trendLine(store.days, { n: 30, end: today }),
      cumulative: cumulativeDone(store.days, { n: 30, end: today }),
      radar: areaBalance(store, 14, today),
      ranking: habitRanking(store, 30, today),
      hours: hourHeatmap(store.days),
      scatter: scatterEnergy(store.days, 'energy'),
      stacked: stackedTasks(store.days, 14, today),
      timeline: timeline(store.days, store.goals, 10),
      bubbles: bubbleHabits(store, 30, today),
      waffle: waffle(store.days, 100, today),
      gauge: monthlyGauge(store, today),
      categories: categoryDistribution(store, 30, today),
      sparklines: store.goals
        .filter((g) => g.active && !g.archived)
        .slice(0, 8)
        .map((g) => ({ goalId: g.id, name: g.name, series: sparkline(store, g.id, 14, today) })),
    };
  }, [store, today]);

  const show = (g: Exclude<Group, 'todos'>) => group === 'todos' || group === g;
  const noClosed = closed.length === 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <ModalHeader
        title="📈 Gráficos"
        subtitle={`${data.calendar.monthLabel} · ${closed.length} dia(s) fechado(s) no histórico`}
      />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80, gap: spacing.md }}>
        <Row gap={6}>
          {GROUPS.map((g) => (
            <Chip
              key={g.key}
              label={g.label}
              selected={group === g.key}
              onPress={() => {
                haptic('select');
                setGroup(g.key);
              }}
            />
          ))}
        </Row>

        {noClosed ? (
          <Card accent={colors.yellow + '44'}>
            <Txt variant="caption" color={colors.yellow}>
              Nenhum dia fechado ainda. Os gráficos aparecem conforme os registros existem — o app não
              desenha linha vazia nem inventa média.
            </Txt>
            <Muted style={{ marginTop: 4 }}>Feche o dia na aba Hoje para começar a alimentar os gráficos.</Muted>
          </Card>
        ) : null}

        <Row gap={spacing.sm}>
          <View style={{ flex: 1 }}>
            <Card style={{ alignItems: 'center' }}>
              <Txt variant="micro" color={colors.textSecondary}>HOJE</Txt>
              <ProgressRing
                ratio={data.ring.ratio}
                done={data.ring.done}
                total={data.ring.total}
                size={124}
                label="checklist do dia"
              />
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card>
              <Txt variant="micro" color={colors.textSecondary}>META DO MÊS</Txt>
              <MonthlyGauge info={data.gauge} size={150} />
            </Card>
          </View>
        </Row>

        {show('constancia') ? (
          <>
            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Heatmap de calendário</Txt>
              <CalendarHeatmap weeks={data.calendar.weeks} monthLabel={data.calendar.monthLabel} />
              <Muted style={{ marginTop: spacing.sm }}>
                Cor = score do dia fechado · célula escura = sem registro · borda branca = hoje
              </Muted>
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Sequência: atual vs recorde</Txt>
              <StreakCompare info={data.streak} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Barras semanais</Txt>
              <PeriodBars buckets={data.weekly} unit="score" />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Barras mensais</Txt>
              <PeriodBars buckets={data.monthly} unit="score" />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Waffle: 100 dias</Txt>
              <WaffleChart cells={data.waffle.cells} done={data.waffle.done} partial={data.waffle.partial} />
            </Card>
          </>
        ) : null}

        {show('padroes') ? (
          <>
            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Taxa de conclusão (média móvel)</Txt>
              <CompletionLine points={data.completion} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Concluídas acumuladas</Txt>
              <CumulativeChart points={data.cumulative} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Tendência do score</Txt>
              {data.trend.reliable ? (
                <>
                  <TrendChart points={data.trend.points} projection={data.trend.projection} />
                  <Muted style={{ marginTop: 6 }}>
                    {data.trend.direction === 'up'
                      ? `Subindo ${data.trend.slope} pts/dia`
                      : data.trend.direction === 'down'
                        ? `Caindo ${Math.abs(data.trend.slope)} pts/dia`
                        : 'Estável no período'}{' '}
                    · {data.trend.points.length} dias
                  </Muted>
                </>
              ) : (
                <NoData label={`Tendência só com 7+ dias (${data.trend.points.length} até agora)`} />
              )}
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Score por dia da semana</Txt>
              <WeekdayGrid data={data.weekdays} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Concluído × pulado × falhou</Txt>
              <StackedBars data={data.stacked} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Por hora do dia</Txt>
              <HourHeatmap data={data.hours} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Energia × execução</Txt>
              <EnergyScatter
                points={data.scatter.points}
                correlation={data.scatter.correlation}
                xLabel="energia média do dia (1-10)"
              />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Timeline de conclusões</Txt>
              <TimelineList items={data.timeline} />
            </Card>
          </>
        ) : null}

        {show('habitos') ? (
          <>
            <Card>
              <Txt variant="h3">Mini séries por hábito (14 dias)</Txt>
              <Muted style={{ marginBottom: spacing.sm }}>
                Barra alta = feita · barra curta vermelha = não feita · sem barra = dia sem o item
              </Muted>
              {data.sparklines.length === 0 ? (
                <NoData label="Nenhum hábito ativo ainda" />
              ) : (
                <View style={{ gap: 10 }}>
                  {data.sparklines.map((h) => (
                    <Row key={h.goalId} style={{ justifyContent: 'space-between', gap: 8 }}>
                      <Txt variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                        {h.name}
                      </Txt>
                      <Sparkline values={h.series} />
                    </Row>
                  ))}
                </View>
              )}
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Ranking de hábitos (30 dias)</Txt>
              <HabitRankingBars data={data.ranking} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Equilíbrio entre áreas</Txt>
              <BalanceRadar data={data.radar} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Consistência por área vs meta</Txt>
              <BarsWithTarget data={data.vsTarget} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Frequência × consistência</Txt>
              <BubbleChart points={data.bubbles} />
            </Card>

            <Card>
              <Txt variant="h3" style={{ marginBottom: spacing.sm }}>Distribuição por área</Txt>
              <CategoryDonut data={data.categories} centerLabel="tarefas feitas" unit=" tarefas" />
            </Card>
          </>
        ) : null}

        <Muted style={{ textAlign: 'center' }}>
          Gráfico sem dado fica em branco de propósito: preencher com média ou zero seria inventar registro.
        </Muted>
      </ScrollView>
    </View>
  );
}
